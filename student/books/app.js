import {
  requireStudent,
  logout
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


const student =
  await requireStudent();


if (!student) {
  throw new Error(
    "Unauthorized"
  );
}


document.getElementById(
  "studentName"
).textContent =
  student.display_name || "";


document.getElementById(
  "logout"
).onclick =
  logout;


const container =
  document.getElementById(
    "books"
  );


/*
 * PDF.js
 */

async function loadPdfJs() {

  return await import(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
  );

}


/*
 * PDFの1ページ目を
 * Book表紙として描画
 */

async function renderPdfThumbnail(
  canvas,
  filePath
) {

  try {

    const {
      data,
      error
    } =
      await supabase.storage
        .from("web-viewer")
        .createSignedUrl(
          filePath,
          300
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      throw new Error(
        "PDF URL error"
      );

    }


    const pdfjs =
      await loadPdfJs();


    const pdf =
      await pdfjs
        .getDocument(
          data.signedUrl
        )
        .promise;


    const page =
      await pdf.getPage(1);


    const baseViewport =
      page.getViewport({
        scale: 1
      });


    const targetWidth =
      260;


    const scale =
      targetWidth /
      baseViewport.width;


    const viewport =
      page.getViewport({
        scale
      });


    canvas.width =
      viewport.width;

    canvas.height =
      viewport.height;


    await page.render({
      canvasContext:
        canvas.getContext(
          "2d"
        ),

      viewport
    }).promise;


  }
  catch (error) {

    console.error(
      "Thumbnail error:",
      error
    );

    canvas.outerHTML =
      `
      <div class="book-placeholder">
        表紙を表示できません
      </div>
      `;

  }

}


/*
 * 画像の1ページ目
 */

async function getImageThumbnail(
  filePath
) {

  const {
    data,
    error
  } =
    await supabase.storage
      .from("web-viewer")
      .createSignedUrl(
        filePath,
        300
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    return null;

  }


  return data.signedUrl;

}


/*
 * Book一覧
 */

async function loadBooks() {

  const {
    data: books,
    error
  } =
    await supabase
      .from("licenses")
      .select(`
        id,
        book_id,
        status,
        books (
          id,
          title,
          description,
          file_path,
          file_type,
          enabled
        )
      `)
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "status",
        "used"
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(error);

    container.innerHTML =
      `
      <div class="empty">
        Bookを取得できませんでした。
      </div>
      `;

    return;

  }


  const validBooks =
    (books || [])
      .filter(
        item =>
          item.books &&
          item.books.enabled
      );


  if (
    validBooks.length === 0
  ) {

    container.innerHTML =
      `
      <div class="empty">
        利用できるBookはありません。
      </div>
      `;

    return;

  }


  /*
   * 画像Book用の1ページ目を取得
   */

  const bookIds =
    validBooks.map(
      item =>
        item.book_id
    );


  const {
    data: pages
  } =
    await supabase
      .from("book_pages")
      .select(
        "book_id,page_number,file_path,file_type"
      )
      .in(
        "book_id",
        bookIds
      )
      .eq(
        "page_number",
        1
      );


  const firstPages =
    new Map(
      (pages || []).map(
        page => [
          page.book_id,
          page
        ]
      )
    );


  container.innerHTML =
    "";


  for (
    const item
    of validBooks
  ) {

    const book =
      item.books;


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "book-card";


    card.innerHTML = `

<div class="book-cover">

${
  book.file_type === "pdf"

  ? `<canvas></canvas>`

  : `<div class="book-placeholder">
       表紙を読み込んでいます
     </div>`
}

</div>

<div class="book-info">

<div class="book-title">
${escapeHtml(
  book.title
)}
</div>

<div class="book-description">
${escapeHtml(
  book.description || ""
)}
</div>

<div class="book-open">
開く
</div>

</div>

`;


    /*
     * Book全体をクリックして
     * 別タブでViewer
     */

    card.onclick = () => {

      window.open(
        "../viewer/?book=" +
        encodeURIComponent(
          book.id
        ),
        "_blank",
        "noopener"
      );

    };


    container.appendChild(
      card
    );


    /*
     * PDF表紙
     */

    if (
      book.file_type ===
      "pdf"
    ) {

      const canvas =
        card.querySelector(
          "canvas"
        );


      await renderPdfThumbnail(
        canvas,
        book.file_path
      );

    }


    /*
     * 画像表紙
     */

    else {

      const firstPage =
        firstPages.get(
          book.id
        );


      if (!firstPage) {
        continue;
      }


      const imageUrl =
        await getImageThumbnail(
          firstPage.file_path
        );


      if (!imageUrl) {
        continue;
      }


      const cover =
        card.querySelector(
          ".book-cover"
        );


      cover.innerHTML =
        "";


      const image =
        document.createElement(
          "img"
        );


      image.src =
        imageUrl;

      image.alt =
        book.title;


      cover.appendChild(
        image
      );

    }

  }

}


loadBooks();
