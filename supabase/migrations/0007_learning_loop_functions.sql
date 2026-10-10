-- SAFAL schema 7: atomic learning-loop operations (backend milestone).
-- Apply AFTER 0001-0006, once, in Supabase > SQL Editor. Do not re-run 0001-0006.
--
-- Why functions: each step below writes several rows (answers + diagnoses + progress, or attempt + keys + support
-- cycle + progress). A function runs as ONE transaction, so a retry or a crash can never leave half a step behind,
-- and the row lock on concept_progress (select ... for update) makes two simultaneous requests take turns.
--
-- Security: no new table, no new table grant, no policy change. The functions run as the CALLER (security invoker),
-- and only service_role (our server) may call them. They are revoked from PUBLIC, anon and authenticated explicitly,
-- because Supabase's default privileges would otherwise let the browser roles call them.
-- The server checks WHO is calling before it uses these. They are the "write" half of that check, not a replacement.
--
-- Every function returns jsonb: { status: 'ok' | 'not_found' | 'wrong_state' | 'conflict' | ..., progress: {...} }.
-- "progress" is the concept_progress row (snake_case) after the call.

-- 1) Open the predefined micro-test. Idempotent: an unanswered micro-test attempt is returned again.
create or replace function public.safal_start_microtest(p_student uuid, p_concept text, p_questions jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prog public.concept_progress%rowtype;
  v_attempt uuid;
begin
  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = p_concept
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_prog.state = 'microtest' then
    select a.id into v_attempt from public.attempts a
     where a.student_id = p_student and a.concept_id = p_concept and a.kind = 'microtest'
       and not exists (select 1 from public.answers x where x.attempt_id = a.id)
     order by a.created_at desc
     limit 1;
    if v_attempt is not null then
      return jsonb_build_object('status', 'ok', 'attempt_id', v_attempt, 'progress', to_jsonb(v_prog));
    end if;
  elsif v_prog.state <> 'doubts' then
    return jsonb_build_object('status', 'wrong_state', 'progress', to_jsonb(v_prog));
  end if;

  insert into public.attempts (student_id, concept_id, kind, cycle, questions)
  values (p_student, p_concept, 'microtest', 0, p_questions)
  returning id into v_attempt;

  update public.concept_progress set state = 'microtest', updated_at = now()
   where id = v_prog.id
  returning * into v_prog;

  return jsonb_build_object('status', 'ok', 'attempt_id', v_attempt, 'progress', to_jsonb(v_prog));
end;
$$;

-- 2) Save one whole sitting: the original answers, their diagnoses, and the new learning state.
-- p_items: [{ question_id, typed_text, upload_path, confirmed_text, interpreted_text, interpreted_by,
--             reading_status, is_correct, diagnosis: { is_correct, reasoning_sound, misconception, evidence,
--             next_action, follow_up_question, ai_source } }]
-- The caller passes the state it expects; if the row has moved on, nothing is written ('conflict').
-- A second submission for the same attempt writes nothing and says 'already_submitted'.
create or replace function public.safal_record_answers(
  p_student uuid,
  p_attempt uuid,
  p_expected_state text,
  p_items jsonb,
  p_new_state text,
  p_new_flagged boolean,
  p_cycle_outcome text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_att public.attempts%rowtype;
  v_prog public.concept_progress%rowtype;
  v_item jsonb;
  v_ans uuid;
begin
  select * into v_att from public.attempts where id = p_attempt and student_id = p_student;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = v_att.concept_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (select 1 from public.answers where attempt_id = p_attempt and kind = 'original') then
    return jsonb_build_object('status', 'already_submitted', 'progress', to_jsonb(v_prog));
  end if;
  if v_prog.state <> p_expected_state then
    return jsonb_build_object('status', 'conflict', 'progress', to_jsonb(v_prog));
  end if;

  for v_item in select e from jsonb_array_elements(p_items) as e loop
    insert into public.answers (
      attempt_id, student_id, question_id, kind, typed_text, upload_path, confirmed_text,
      interpreted_text, interpreted_by, reading_status, is_correct)
    values (
      p_attempt, p_student, v_item ->> 'question_id', 'original', v_item ->> 'typed_text',
      v_item ->> 'upload_path', v_item ->> 'confirmed_text', v_item ->> 'interpreted_text',
      v_item ->> 'interpreted_by', v_item ->> 'reading_status', (v_item ->> 'is_correct')::boolean)
    returning id into v_ans;

    insert into public.diagnoses (
      answer_id, student_id, concept_id, is_correct, reasoning_sound, misconception, evidence,
      next_action, follow_up_question, ai_source)
    values (
      v_ans, p_student, v_att.concept_id,
      (v_item #>> '{diagnosis,is_correct}')::boolean, (v_item #>> '{diagnosis,reasoning_sound}')::boolean,
      v_item #>> '{diagnosis,misconception}', v_item #>> '{diagnosis,evidence}',
      v_item #>> '{diagnosis,next_action}', v_item #>> '{diagnosis,follow_up_question}',
      v_item #>> '{diagnosis,ai_source}');
  end loop;

  update public.concept_progress
     set state = p_new_state, teacher_flagged = p_new_flagged, updated_at = now()
   where id = v_prog.id
  returning * into v_prog;

  if p_cycle_outcome is not null then
    update public.support_cycles set outcome = p_cycle_outcome
     where reassessment_attempt_id = p_attempt and outcome = 'pending';
  end if;

  return jsonb_build_object('status', 'ok', 'progress', to_jsonb(v_prog));
end;
$$;

-- 3) Save the student's reply to ONE follow-up question, its fresh diagnosis, and the new learning state.
-- The reply is a second answers row (kind = 'clarification') that points at the original; the original is never edited.
-- The fresh diagnosis is stored against the clarification row, which is what the student screen reads on reload.
-- This never changes support_cycles_used: a clarification is not a failed cycle.
create or replace function public.safal_record_clarification(
  p_student uuid,
  p_attempt uuid,
  p_question_id text,
  p_response text,
  p_expected_state text,
  p_diagnosis jsonb,
  p_is_correct boolean,
  p_new_state text,
  p_new_flagged boolean,
  p_cycle_outcome text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_att public.attempts%rowtype;
  v_prog public.concept_progress%rowtype;
  v_orig uuid;
  v_ans uuid;
begin
  select * into v_att from public.attempts where id = p_attempt and student_id = p_student;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = v_att.concept_id
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id into v_orig from public.answers
   where attempt_id = p_attempt and student_id = p_student and question_id = p_question_id and kind = 'original';
  if v_orig is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (select 1 from public.answers where clarifies_answer_id = v_orig) then
    return jsonb_build_object('status', 'already_clarified', 'progress', to_jsonb(v_prog));
  end if;
  if v_prog.state <> p_expected_state then
    return jsonb_build_object('status', 'conflict', 'progress', to_jsonb(v_prog));
  end if;

  insert into public.answers (
    attempt_id, student_id, question_id, kind, clarifies_answer_id, typed_text, is_correct)
  values (p_attempt, p_student, p_question_id, 'clarification', v_orig, p_response, p_is_correct)
  returning id into v_ans;

  insert into public.diagnoses (
    answer_id, student_id, concept_id, is_correct, reasoning_sound, misconception, evidence,
    next_action, follow_up_question, ai_source)
  values (
    v_ans, p_student, v_att.concept_id,
    (p_diagnosis ->> 'is_correct')::boolean, (p_diagnosis ->> 'reasoning_sound')::boolean,
    p_diagnosis ->> 'misconception', p_diagnosis ->> 'evidence',
    p_diagnosis ->> 'next_action', p_diagnosis ->> 'follow_up_question', p_diagnosis ->> 'ai_source');

  update public.concept_progress
     set state = p_new_state, teacher_flagged = p_new_flagged, updated_at = now()
   where id = v_prog.id
  returning * into v_prog;

  if p_cycle_outcome is not null then
    update public.support_cycles set outcome = p_cycle_outcome
     where reassessment_attempt_id = p_attempt and outcome = 'pending';
  end if;

  return jsonb_build_object('status', 'ok', 'progress', to_jsonb(v_prog));
end;
$$;

-- 4) Start one support/reassessment cycle: the reassessment attempt, its hidden keys, the support plan, and the
-- cycle counter, all or nothing. At most two cycles: a third is refused ('wrong_state'). Idempotent: if the cycle
-- is already open ('reassessment' state), nothing new is written and the existing one is returned.
-- p_questions: student-safe [{ id, prompt }]. p_keys: hidden [{ question_id, expected_idea }].
create or replace function public.safal_start_support(
  p_student uuid,
  p_concept text,
  p_support jsonb,
  p_diagnosis_id uuid,
  p_ai_source text,
  p_questions jsonb,
  p_keys jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prog public.concept_progress%rowtype;
  v_cycle int;
  v_attempt uuid;
  v_existing public.support_cycles%rowtype;
begin
  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = p_concept
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_prog.state = 'reassessment' then
    select * into v_existing from public.support_cycles
     where student_id = p_student and concept_id = p_concept and cycle_number = v_prog.support_cycles_used;
    if found and v_existing.reassessment_attempt_id is not null then
      return jsonb_build_object(
        'status', 'already_started', 'attempt_id', v_existing.reassessment_attempt_id,
        'support', v_existing.support, 'progress', to_jsonb(v_prog));
    end if;
    return jsonb_build_object('status', 'wrong_state', 'progress', to_jsonb(v_prog));
  end if;

  if v_prog.state <> 'support' or v_prog.teacher_flagged or v_prog.support_cycles_used >= 2 then
    return jsonb_build_object('status', 'wrong_state', 'progress', to_jsonb(v_prog));
  end if;

  v_cycle := v_prog.support_cycles_used + 1;

  insert into public.attempts (student_id, concept_id, kind, cycle, questions, ai_source)
  values (p_student, p_concept, 'reassessment', v_cycle, p_questions, p_ai_source)
  returning id into v_attempt;

  insert into public.generated_question_keys (attempt_id, question_id, expected_idea)
  select v_attempt, e ->> 'question_id', e ->> 'expected_idea'
    from jsonb_array_elements(p_keys) as e;

  insert into public.support_cycles (
    student_id, concept_id, cycle_number, diagnosis_id, support, reassessment_attempt_id, ai_source)
  values (p_student, p_concept, v_cycle, p_diagnosis_id, p_support, v_attempt, p_ai_source);

  update public.concept_progress
     set state = 'reassessment', support_cycles_used = v_cycle, updated_at = now()
   where id = v_prog.id
  returning * into v_prog;

  return jsonb_build_object('status', 'ok', 'attempt_id', v_attempt, 'progress', to_jsonb(v_prog));
end;
$$;

-- 5) Teacher approval to move on, all or nothing: set teacher_cleared_to_next, add the next concept's row in
-- 'lesson' state if absent (never overwriting an existing row), and append the audit row.
-- The server plans the approval and passes the facts it planned from; if the row has changed since,
-- nothing is written ('conflict') and the server re-plans.
-- A repeated approval (p_set_cleared false, p_create_next false) writes nothing: no audit row, no reset.
create or replace function public.safal_teacher_approve(
  p_teacher uuid,
  p_student uuid,
  p_concept text,
  p_next_concept text,
  p_expected_state text,
  p_expected_cleared boolean,
  p_set_cleared boolean,
  p_create_next boolean,
  p_note text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prog public.concept_progress%rowtype;
  v_next public.concept_progress%rowtype;
  v_next_json jsonb;
  v_created boolean := false;
  v_count int;
begin
  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = p_concept
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_prog.state <> p_expected_state or v_prog.teacher_cleared_to_next <> p_expected_cleared then
    return jsonb_build_object('status', 'conflict', 'progress', to_jsonb(v_prog));
  end if;

  if p_set_cleared then
    update public.concept_progress set teacher_cleared_to_next = true, updated_at = now()
     where id = v_prog.id
    returning * into v_prog;
  end if;

  if p_create_next and p_next_concept is not null then
    insert into public.concept_progress (student_id, concept_id, state)
    values (p_student, p_next_concept, 'lesson')
    on conflict (student_id, concept_id) do nothing;
    get diagnostics v_count = row_count;
    v_created := v_count > 0;
  end if;

  if p_next_concept is not null then
    select * into v_next from public.concept_progress
     where student_id = p_student and concept_id = p_next_concept;
    if found then
      v_next_json := to_jsonb(v_next);
    end if;
  end if;

  if p_set_cleared or v_created then
    insert into public.teacher_actions (teacher_id, student_id, concept_id, action, note, payload)
    values (p_teacher, p_student, p_concept, 'approve_next_concept', p_note,
            coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('createdNextProgress', v_created));
  end if;

  return jsonb_build_object(
    'status', 'ok', 'progress', to_jsonb(v_prog), 'next_progress', v_next_json, 'created_next', v_created);
end;
$$;

-- 6) Teacher clears the attention flag and NOTHING else (state, cycle count and approval are untouched),
-- and appends the audit row. If the flag is already clear, nothing is written ('already').
create or replace function public.safal_teacher_clear_flag(
  p_teacher uuid,
  p_student uuid,
  p_concept text,
  p_note text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prog public.concept_progress%rowtype;
begin
  select * into v_prog from public.concept_progress
   where student_id = p_student and concept_id = p_concept
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not v_prog.teacher_flagged then
    return jsonb_build_object('status', 'already', 'progress', to_jsonb(v_prog));
  end if;

  update public.concept_progress set teacher_flagged = false, updated_at = now()
   where id = v_prog.id
  returning * into v_prog;

  insert into public.teacher_actions (teacher_id, student_id, concept_id, action, note, payload)
  values (p_teacher, p_student, p_concept, 'clear_flag', p_note, coalesce(p_payload, '{}'::jsonb));

  return jsonb_build_object('status', 'ok', 'progress', to_jsonb(v_prog));
end;
$$;

-- ---- Who may call these: the server only. -------------------------------------------------------------------
revoke all on function public.safal_start_microtest(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.safal_record_answers(uuid, uuid, text, jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.safal_record_clarification(uuid, uuid, text, text, text, jsonb, boolean, text, boolean, text) from public, anon, authenticated;
revoke all on function public.safal_start_support(uuid, text, jsonb, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.safal_teacher_approve(uuid, uuid, text, text, text, boolean, boolean, boolean, text, jsonb) from public, anon, authenticated;
revoke all on function public.safal_teacher_clear_flag(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.safal_start_microtest(uuid, text, jsonb) to service_role;
grant execute on function public.safal_record_answers(uuid, uuid, text, jsonb, text, boolean, text) to service_role;
grant execute on function public.safal_record_clarification(uuid, uuid, text, text, text, jsonb, boolean, text, boolean, text) to service_role;
grant execute on function public.safal_start_support(uuid, text, jsonb, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.safal_teacher_approve(uuid, uuid, text, text, text, boolean, boolean, boolean, text, jsonb) to service_role;
grant execute on function public.safal_teacher_clear_flag(uuid, uuid, text, text, jsonb) to service_role;

-- Ask the Data API to pick up the new functions straight away.
notify pgrst, 'reload schema';
