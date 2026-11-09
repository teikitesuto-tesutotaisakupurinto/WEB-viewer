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


const booksContainer =
  document.getElementById(
    "books"
  );


const registerButton =
  document.getElementById(
    "register"
  );


const serialInput =
  document.getElementById(
    "serialCode"
  );


const registerMessage =
  document.getElementById(
    "registerMessage"
  );


/*
 * ログアウト
 */

document.getElementById(
  "logout"
).onclick =
  event => {

    event.preventDefault();

    logout();

  };


/*
 * ========================================
 * 生徒確認
 * ========================================
 */

async function start() {

  const student =
    await requireStudent();


  if (!student) {
    return;
  }


  document.getElementById(
    "studentName"
  ).textContent =
    student.display_name || "";


  /*
   * シリアル登録
   */

  registerButton.onclick =
    () => registerBook();


  /*
   * Enterでも登録
   */

  serialInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        registerBook();

      }

    }
  );


  /*
   * Book一覧
   */

  await loadBooks();

}


/*
 * ========================================
 * シリアル登録
 * ========================================
 */

async function registerBook() {

  const code =
    serialInput.value
      .trim()
      .toUpperCase()
      .replace(
        /\s+/g,
        ""
      );


  registerMessage.classList.remove(
    "error"
  );


  if (!code) {

    registerMessage.textContent =
      "シリアルコードを入力してください。";

    registerMessage.classList.add(
      "error"
    );

    return;

  }


  registerButton.disabled =
    true;


  registerMessage.textContent =
    "教材を登録しています。";


  try {

    /*
     * DB側のRPCで登録
     */

    const {
      data,
      error
    } =
      await supabase.rpc(
        "register_book_by_serial",
        {
          input_code:
            code
        }
      );


    if (error) {

      throw error;

    }


    if (
      !data?.success
    ) {

      throw new Error(
        "教材を登録できませんでした。"
      );

    }


    registerMessage.textContent =
      `${data.title} を登録しました。`;


    serialInput.value =
      "";


    /*
     * My Booksを即更新
     */

    await loadBooks();

  }
  catch (error) {

    console.error(
      "SERIAL REGISTER ERROR:",
      error
    );


    registerMessage.textContent =
      error.message ||
      "シリアル登録に失敗しました。";


    registerMessage.classList.add(
      "error"
    );

  }
  finally {

    registerButton.disabled =
      false;

  }

}


/*
 * ========================================
 * Book一覧
 * ========================================
 */

async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="book-empty">
      Bookを読み込んでいます。
    </div>
    `;


  try {

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
          created_at,
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
          (
            await supabase.auth
              .getUser()
          ).data.user.id
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

      throw new Error(
        "Book取得エラー: " +
        error.message
      );

    }


    const books =
      (data || []).filter(
        item =>
          item.books &&
          item.books.enabled
      );


    if (
      books.length === 0
    ) {

      booksContainer.innerHTML =
        `
        <div class="book-empty">
          登録されている教材はありません。
        </div>
        `;

      return;

    }


    /*
     * 画像Bookの1ページ目
     */

    const bookIds =
      books.map(
        item =>
          item.book_id
      );


    const {
      data: pages,
      error: pagesError
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


    if (pagesError) {
      throw pagesError;
    }


    const firstPages =
      new Map(
        (pages || []).map(
          page => [
            page.book_id,
            page
          ]
        )
      );


    booksContainer.innerHTML =
      "";


    /*
     * 表示
     */

    for (
      const item
      of books
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

        <div class="book-cover"></div>

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
       * Viewerを別タブ
       */

      card.onclick =
        () => {

          window.open(
            "../viewer/?book=" +
            encodeURIComponent(
              book.id
            ),
            "_blank"
          );

        };


      booksContainer.appendChild(
        card
      );


      const cover =
        card.querySelector(
          ".book-cover"
        );


      /*
       * PDF表紙
       */

      if (
        String(
          book.file_type || ""
        ).toLowerCase() ===
        "pdf"
      ) {

        try {

          await renderPdfCover(
            cover,
            book.file_path
          );

        }
        catch (
          error
        ) {

          console.error(
            "COVER ERROR:",
            error
          );

        }

        continue;

      }


      /*
       * 画像表紙
       */

      const firstPage =
        firstPages.get(
          book.id
        );


      if (!firstPage) {

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
  catch (error) {

    console.error(
      "BOOK LIST ERROR:",
      error
    );


    booksContainer.innerHTML =
      `

      <div class="page-error">

        <h2>
          教材を読み込めませんでした
        </h2>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

        <button
          type="button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

      `;

  }

}


/*
 * ========================================
 * PDF表紙
 * ========================================
 */

async function renderPdfCover(
  container,
  path
) {

  const {
    data,
    error
  } =
    await supabase.storage
      .from("web-viewer")
      .createSignedUrl(
        path,
        300
      );


  if (error) {
    throw error;
  }


  if (
    !data?.signedUrl
  ) {

    throw new Error(
      "PDFのURLを取得できませんでした。"
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


  const scale =
    260 /
    base.width;


  const viewport =
    page.getViewport({
      scale
    });


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.floor(
      viewport.width
    );


  canvas.height =
    Math.floor(
      viewport.height
    );


  container.appendChild(
    canvas
  );


  await page.render({
    canvasContext:
      canvas.getContext(
        "2d"
      ),

    viewport

  }).promise;

}


/*
 * ========================================
 * 起動
 * ========================================
 */

start()
  .catch(
    error => {

      console.error(
        "STUDENT BOOK ERROR:",
        error
      );


      booksContainer.innerHTML =
        `

        <div class="page-error">

          <h2>
            My Booksを読み込めませんでした
          </h2>

          <p>
            ${escapeHtml(
              error.message
            )}
          </p>

          <button
            type="button"
            onclick="location.reload()">

            再読み込み

          </button>

        </div>

        `;

    }
  );
