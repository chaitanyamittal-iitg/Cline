-- SAFAL seed 2/2: predefined micro-test questions (written/open-ended, no MCQs) and hidden keys.
-- DRAFT CONTENT for teacher review. C3 (Complete circuits) is the first fully built journey.
-- Run AFTER content_1_concepts_resources.sql. Safe to re-run.

insert into public.questions (id, concept_id, prompt, position) values
  ('C1-Q1', 'C1', 'A cell is connected to a bulb with wires. Which part of the circuit is the source of electrical energy, and which terminal of it is the positive one? Explain how you know.', 1),
  ('C1-Q2', 'C1', 'Why do we mark a cell with a positive and a negative terminal? What would be different if you connected it the other way round?', 2),
  ('C2-Q1', 'C2', 'A student places a plastic ruler in the gap of a circuit with a bulb. Will the bulb light? Explain your answer.', 1),
  ('C2-Q2', 'C2', 'Electric wires are made of metal on the inside but covered in plastic on the outside. Why is each material used?', 2),
  ('C3-Q1', 'C3', 'A bulb is connected with one wire from the positive terminal of a cell, but nothing is connected to the negative terminal. Will the bulb light? Explain your answer.', 1),
  ('C3-Q2', 'C3', 'A circuit has a cell, a bulb and a switch. The switch is open. Will the bulb light? Explain what is happening to the path of the current.', 2),
  ('C3-Q3', 'C3', 'Describe in your own words what a "complete circuit" is and why current needs one.', 3),
  ('C4-Q1', 'C4', 'A bulb in a simple circuit does not light. List two different faults that could cause this and say how you would check each one.', 1),
  ('C4-Q2', 'C4', 'A student built a circuit using a wooden strip to join two wires. The bulb stays off. Find the fault and explain how to fix it.', 2)
on conflict (id) do update set concept_id = excluded.concept_id, prompt = excluded.prompt, position = excluded.position;

insert into public.question_keys (question_id, expected_idea, common_misconceptions) values
  ('C1-Q1', 'The cell (or battery) is the source. The longer / marked + end is the positive terminal. The student should give a reason such as the + marking or symbol.', array['Thinks the bulb is the source of electricity', 'Cannot tell the two terminals apart']),
  ('C1-Q2', 'Terminals show the direction in which the cell pushes current. Reversing changes the direction of current; a simple bulb still lights but some devices will not work.', array['Thinks the terminal labels make no difference to anything']),
  ('C2-Q1', 'No. Plastic is an insulator, so it does not let current pass and the path is not complete.', array['Thinks any solid object can complete the circuit', 'Confuses conductor and insulator']),
  ('C2-Q2', 'Metal is a conductor so it carries current. Plastic is an insulator so it keeps the current in the wire and keeps people safe.', array['Swaps the roles of the metal and the plastic', 'Thinks plastic helps current flow']),
  ('C3-Q1', 'No. Current needs a complete path from the positive terminal through the bulb back to the negative terminal. One wire is not enough.', array['Believes current flows out of one terminal and is used up by the bulb, so no return path is needed', 'Believes one wire to the bulb is enough']),
  ('C3-Q2', 'No. An open switch is a gap in the path, so the circuit is not complete and no current flows.', array['Thinks the switch only controls brightness', 'Thinks current still reaches the bulb with the switch open']),
  ('C3-Q3', 'A complete circuit is an unbroken closed loop of conductors from one terminal of the cell, through the components, to the other terminal. Current flows only around a closed loop.', array['Describes a circuit as just "connected to a battery"', 'Does not mention a return path or closed loop']),
  ('C4-Q1', 'Any two valid faults, such as a broken wire, loose connection, open switch, used-up cell, or an insulator in the path, each with a sensible check.', array['Only names one kind of fault', 'Suggests replacing the bulb without checking the path']),
  ('C4-Q2', 'Wood is an insulator, so the path is broken. Replace the wooden strip with a conductor such as a metal strip or wire.', array['Thinks the bulb is faulty', 'Does not identify wood as an insulator'])
on conflict (question_id) do update set expected_idea = excluded.expected_idea,
  common_misconceptions = excluded.common_misconceptions;
