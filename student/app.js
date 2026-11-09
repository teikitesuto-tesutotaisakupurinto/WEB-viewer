import {
  requireStudent
}
from "../assets/js/auth.js";


const student =
  await requireStudent();


if (!student) {
  throw new Error("Unauthorized");
}


location.replace(
  "./books/"
);
