import {
  requireAdmin
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  escapeHtml
}
from "../../assets/js/common.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


const {
  data,
  error
} =
  await supabase
    .from("users")
    .select("*")
    .eq("role", "student")
    .order("display_name");


if (error) {

  console.error(error);

}


document.getElementById(
  "students"
).innerHTML = `

<table>

<thead>

<tr>
<th>氏名</th>
<th>メール</th>
<th>クラス</th>
<th>番号</th>
</tr>

</thead>

<tbody>

${(data || []).map(student => `

<tr>

<td>
${escapeHtml(student.display_name)}
</td>

<td>
${escapeHtml(student.email)}
</td>

<td>
${escapeHtml(student.class_name)}
</td>

<td>
${escapeHtml(student.student_number)}
</td>

</tr>

`).join("")}

</tbody>

</table>

`;
