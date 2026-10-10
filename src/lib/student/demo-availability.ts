// Which student controls are usable in THIS DEMO BUILD. Interface-only switches: they never fake a response.
// When a feature's backend route does not exist yet, its control is shown disabled and labelled "unavailable for
// this demo" instead of being left to fail. Flip a value to true once the route ships (and has been tested).
//   tutor       -> POST /api/tutor    (not implemented on origin/main yet)
//   photoUpload -> POST /api/upload   (not implemented on origin/main yet)
// The skip-doubts button (/api/attempts/start) and typed answers (/api/answers) do not depend on these.
export const DEMO_AVAILABILITY: { tutor: boolean; photoUpload: boolean } = {
  tutor: false,
  photoUpload: false,
};

export const TUTOR_UNAVAILABLE_NOTICE =
  "Asking the tutor is unavailable for this demo. You can still start your micro-test below.";
export const TUTOR_UNAVAILABLE_BUTTON = "Tutor unavailable for this demo";

export const PHOTO_UNAVAILABLE_NOTICE = "Photo upload is unavailable for this demo. Please type your answer.";
export const PHOTO_UNAVAILABLE_BUTTON = "Add a photo (unavailable for this demo)";
