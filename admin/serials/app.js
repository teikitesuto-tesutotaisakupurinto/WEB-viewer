import {
  requireAdmin
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";

import {
  makeCode,
  escapeHtml
}
from "../../assets/js/common.js";


const admin =
  await requireAdmin();

if (!admin) {
  throw new Error("Unauthorized");
}


async function loadBooks() {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .select("id,title")
      .eq("enabled", true)
      .order("title");


  if (error) {

    console.error(error);

    return;
  }


  document.getElementById(
    "book"
  ).innerHTML =
    (data || []).map(book => `

<option value="${book.id}">
${escapeHtml(book.title)}
</option>

`).join("");
}


async function loadSerials() {

  const {
    data,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        code,
        status,
        student_id,
        books (
          title
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    return;
  }


  document.getElementById(
    "serials"
  ).innerHTML = `

<table>

<thead>

<tr>
<th>コード</th>
<th>Book</th>
<th>状態</th>
<th>Student</th>
</tr>

</thead>

<tbody>

${(data || []).map(item => `

<tr>

<td>
${escapeHtml(item.code)}
</td>

<td>
${escapeHtml(
  item.books?.title || ""
)}
</td>

<td>
${escapeHtml(item.status)}
</td>

<td>
${escapeHtml(
  item.student_id || ""
)}
</td>

</tr>

`).join("")}

</tbody>

</table>

`;
}


document.getElementById(
  "issue"
).onclick = async () => {

  const bookId =
    document.getElementById(
      "book"
    ).value;

  const count =
    Number(
      document.getElementById(
        "count"
      ).value
    );


  if (
    !bookId ||
    count < 1 ||
    count > 500
  ) {

    return;
  }


  const rows = [];


  for (
    let i = 0;
    i < count;
    i++
  ) {

    rows.push({
      code: makeCode(),
      book_id: bookId,
      status: "unused",
      created_by: admin.id
    });

  }


  const {
    error
  } =
    await supabase
      .from("licenses")
      .insert(rows);


  if (error) {

    console.error(error);

    alert(
      "シリアル発行に失敗しました。"
    );

    return;
  }


  await loadSerials();

};


await loadBooks();
await loadSerials();
