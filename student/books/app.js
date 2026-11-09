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
  throw new Error("Unauthorized");
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
 * PDF表紙
 *
 * PDF全体は読み込まず、
 * 1ページ目だけ取得する。
 */

async function renderPdfCover(
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
      await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
      );


    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


    const pdf =
      await pdfjs
        .getDocument(
          data.signedUrl
        )
        .promise;


    const page =
      await pdf.getPage(1);


    const base =
      page.getViewport({
        scale: 1
      });


    const width =
      260;


    const scale =
      width /
      base.width;


    const viewport =
      page.getViewport({
        scale
      });


    canvas.width =
      Math.floor(
        viewport.width
      );


    canvas.height =
      Math.floor(
        viewport.height
      );


    await page.render({
      canvasContext:
        canvas.getContext("2d"),

      viewport
    }).promise;

  }
  catch (error) {

    console.error(
      "PDF COVER ERROR:",
      error
    );

  }

}


/*
 * Book一覧
 */

async function loadBooks() {

  const {
    data,
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
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    container.innerHTML =
      `
      <div class="book-empty">
        Bookを取得できませんでした。
      </div>
      `;

    return;
  }


  const items =
    (data || []).filter(
      item =>
        item.books &&
        item.books.enabled
    );


  if (
    items.length === 0
  ) {

    container.innerHTML =
      `
      <div class="book-empty">
        利用できるBookはありません。
      </div>
      `;

    return;
  }


  /*
   * 画像Bookの1ページ目だけ取得
   */

  const bookIds =
    items.map(
      item =>
        item.book_id
    );


  const {
    data: pages
  } =
    await supabase
      .from("book_pages")
      .select(
        "book_id,file_path"
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
    const item of items
  ) {

    const book =
      item.books;


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "book-card";


    const cover =
      document.createElement(
        "div"
      );


    cover.className =
      "book-cover";


    const info =
      document.createElement(
        "div"
      );


    info.className =
      "book-info";


    info.innerHTML = `

<div class="book-title">
${escapeHtml(book.title)}
</div>

<div class="book-description">
${escapeHtml(
  book.description || ""
)}
</div>

<div class="book-open">
開く
</div>

`;


    card.appendChild(
      cover
    );

    card.appendChild(
      info
    );


    /*
     * Viewerを別タブで開く。
     *
     * noopenerを付けないことで
     * Viewer側からwindow.close()できる
     * openerを保持する。
     */

    card.onclick = () => {

      window.open(
        "../viewer/?book=" +
        encodeURIComponent(
          book.id
        ),
        "_blank"
      );

    };


    container.appendChild(
      card
    );


    /*
     * PDF
     */

    if (
      String(
        book.file_type || ""
      ).toLowerCase() ===
      "pdf"
    ) {

      const canvas =
        document.createElement(
          "canvas"
        );


      cover.appendChild(
        canvas
      );


      await renderPdfCover(
        canvas,
        book.file_path
      );


      continue;
    }


    /*
     * 画像
     */

    const firstPage =
      firstPages.get(
        book.id
      );


    if (!firstPage) {

      cover.innerHTML =
        `
        <div class="book-placeholder">
          表紙なし
        </div>
        `;

      continue;
    }


    const {
      data: imageData
    } =
      await supabase.storage
        .from("web-viewer")
        .createSignedUrl(
          firstPage.file_path,
          300
        );


    if (
      imageData?.signedUrl
    ) {

      const image =
        document.createElement(
          "img"
        );


      image.src =
        imageData.signedUrl;


      image.alt =
        book.title;


      cover.appendChild(
        image
      );

    }

  }

}


loadBooks();
