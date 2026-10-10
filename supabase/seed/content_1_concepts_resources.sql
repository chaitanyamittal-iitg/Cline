-- SAFAL seed 1/2: four concepts and teacher-approved resources (Classes 6-8, electricity).
-- DRAFT CONTENT written by the dev team for review. A teacher must check it before real use.
-- Safe to re-run (upserts). Contains NO student data.

insert into public.concepts (id, position, title, objective) values
  ('C1', 1, 'Sources and terminals', 'Identify a cell or battery as the source and name its positive and negative terminals in a simple circuit.'),
  ('C2', 2, 'Conducting materials', 'Distinguish common conductors and insulators in the example circuit.'),
  ('C3', 3, 'Complete circuits', 'Explain why a complete conducting path and a closed switch matter.'),
  ('C4', 4, 'Finding faults', 'Locate a break or unsuitable material in a simple circuit.')
on conflict (id) do update set position = excluded.position, title = excluded.title, objective = excluded.objective;

-- url = 'PLACEHOLDER_VIDEO_URL' until the teacher picks real videos. Diagram files are added later under /public/diagrams.
insert into public.resources (id, concept_id, kind, title, url, body, approved, position) values
  ('C1-lecture', 'C1', 'lecture_video', 'Lesson video: Sources and terminals', 'PLACEHOLDER_VIDEO_URL', null, true, 1),
  ('C1-reading', 'C1', 'reading', 'Reading: What a cell does', null, 'A cell is a source of electrical energy. It has two terminals: positive (+) and negative (-). The cell pushes current around the circuit.', true, 2),
  ('C1-diagram', 'C1', 'diagram', 'Diagram: Cell with labelled terminals', '/diagrams/c1-cell-terminals.svg', 'A single cell with its positive and negative terminals labelled.', true, 3),
  ('C2-lecture', 'C2', 'lecture_video', 'Lesson video: Conducting materials', 'PLACEHOLDER_VIDEO_URL', null, true, 1),
  ('C2-reading', 'C2', 'reading', 'Reading: Conductors and insulators', null, 'Conductors such as copper, aluminium and iron let current pass easily. Insulators such as plastic, rubber, wood and glass do not. Wires are metal inside and plastic outside for this reason.', true, 2),
  ('C2-diagram', 'C2', 'diagram', 'Diagram: Testing materials in a circuit', '/diagrams/c2-test-materials.svg', 'A bulb circuit with a gap where different materials are placed. The bulb lights only for conductors.', true, 3),
  ('C3-lecture', 'C3', 'lecture_video', 'Lesson video: Complete circuits', 'PLACEHOLDER_VIDEO_URL', null, true, 1),
  ('C3-reading', 'C3', 'reading', 'Reading: Open and closed circuits', null, 'Current flows only when there is a complete, unbroken conducting path from one terminal of the cell, through the bulb, and back to the other terminal. A closed switch completes the path. An open switch is a gap, so the bulb stays off.', true, 2),
  ('C3-diagram-open', 'C3', 'diagram', 'Diagram: Open circuit', '/diagrams/c3-open-circuit.svg', 'A cell, bulb and open switch. The path is broken at the switch, so the bulb is off.', true, 3),
  ('C3-diagram-closed', 'C3', 'diagram', 'Diagram: Closed circuit', '/diagrams/c3-closed-circuit.svg', 'The same circuit with the switch closed. The path is complete, so the bulb is on.', true, 4),
  ('C3-video', 'C3', 'video', 'Animation: Current flowing in a closed circuit', 'PLACEHOLDER_VIDEO_URL', null, true, 5),
  ('C4-lecture', 'C4', 'lecture_video', 'Lesson video: Finding faults', 'PLACEHOLDER_VIDEO_URL', null, true, 1),
  ('C4-reading', 'C4', 'reading', 'Reading: Why a circuit may not work', null, 'If a bulb does not light, check for a break in the wire, a loose connection, an open switch, a cell with no energy left, or an insulating material where a conductor should be.', true, 2),
  ('C4-diagram', 'C4', 'diagram', 'Diagram: Circuit with a hidden fault', '/diagrams/c4-fault.svg', 'A circuit with one broken wire section marked with a question mark.', true, 3)
on conflict (id) do update set kind = excluded.kind, title = excluded.title, url = excluded.url,
  body = excluded.body, approved = excluded.approved, position = excluded.position;
