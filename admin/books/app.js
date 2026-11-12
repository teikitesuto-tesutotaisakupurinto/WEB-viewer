
import {
  requireAdmin,
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


const formCard =
  document.getElementById(
    "formCard"
  );

const booksContainer =
  document.getElementById(
    "books"
  );

const message =
  document.getElementById(
    "message"
  );

const fileInput =
  document.getElementById(
    "files"
  );

const filePreview =
  document.getElementById(
    "filePreview"
  );

const createButton =
  document.getElementById(
    "create"
  );


/* =========================================================
   Logout
   ========================================================= */

document
  .getElementById("logout")
  .addEventListener(
    "click",
    event => {

      event.preventDefault();

      logout();

    }
  );


/* =========================================================
   Form
   ========================================================= */

document
  .getElementById("showForm")
  .addEventListener(
    "click",
    () => {

      formCard.classList.remove(
        "hidden"
      );

      message.textContent =
        "";

    }
  );


document
  .getElementById("cancel")
  .addEventListener(
    "click",
    () => {

      clearForm();

      formCard.classList.add(
        "hidden"
      );

    }
  );


fileInput.addEventListener(
  "change",
  previewFiles
);


/* =========================================================
   Preview
   ========================================================= */

function previewFiles() {

  filePreview.innerHTML =
    "";


  const files =
    Array.from(
      fileInput.files || []
    );


  files.forEach(
    (
      file,
      index
    ) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "file-preview-item";


      const number =
        document.createElement(
          "div"
        );

      number.className =
        "file-preview-number";

      number.textContent =
        index + 1;


      item.appendChild(
        number
      );


      if (
        /\.(jpg|jpeg|png)$/i
          .test(file.name)
      ) {

        const image =
          document.createElement(
            "img"
          );

        const url =
          URL.createObjectURL(
            file
          );


        image.src =
          url;


        image.onload =
          () => {

            URL.revokeObjectURL(
              url
            );

          };


        item.appendChild(
          image
        );

      }
      else {

        const pdf =
          document.createElement(
            "div"
          );

        pdf.className =
          "file-preview-pdf";

        pdf.textContent =
          "PDF";


        item.appendChild(
          pdf
        );

      }


      filePreview.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   Clear
   ========================================================= */

function clearForm() {

  document.getElementById(
    "title"
  ).value =
    "";

  document.getElementById(
    "description"
  ).value =
    "";

  fileInput.value =
    "";

  filePreview.innerHTML =
    "";

  message.textContent =
    "";

}


/* =========================================================
   Validate
   ========================================================= */

function classifyFiles(
  files
) {

  if (!files.length) {

    throw new Error(
      "教材ファイルを選択してください。"
    );

  }


  const pdfFiles =
    files.filter(
      file =>
        /\.pdf$/i.test(
          file.name
        )
    );


  const imageFiles =
    files.filter(
      file =>
        /\.(jpg|jpeg|png)$/i.test(
          file.name
        )
    );


  if (
    pdfFiles.length +
    imageFiles.length !==
    files.length
  ) {

    throw new Error(
      "PDF、JPG、JPEG、PNGのみ登録できます。"
    );

  }


  if (
    pdfFiles.length &&
    imageFiles.length
  ) {

    throw new Error(
      "PDFと画像は同時に登録できません。"
    );

  }


  if (
    pdfFiles.length > 1
  ) {

    throw new Error(
      "PDFは1ファイルだけ登録できます。"
    );

  }


  return {
    pdfFiles,
    imageFiles
  };

}


/* =========================================================
   Storage Upload
   ========================================================= */

async function uploadFile(
  file
) {

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  const path =
    `books/${crypto.randomUUID()}.${extension}`;


  const contentType =
    file.type ||
    (
      extension === "pdf"
        ? "application/pdf"
        : extension === "jpg" ||
          extension === "jpeg"
          ? "image/jpeg"
          : "image/png"
    );


  const {
    error
  } =
    await supabase.storage
      .from("web-viewer")
      .upload(
        path,
        file,
        {
          upsert: false,
          contentType
        }
      );


  if (error) {

    throw new Error(
      "ファイルのアップロードに失敗しました: " +
      error.message
    );

  }


  return path;

}


/* =========================================================
   Book登録
   ========================================================= */

async function createBook() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  const title =
    document
      .getElementById("title")
      .value
      .trim();


  const description =
    document
      .getElementById("description")
      .value
      .trim();


  const files =
    Array.from(
      fileInput.files || []
    );


  if (!title) {

    message.textContent =
      "Book名を入力してください。";

    return;

  }


  let classified;


  try {

    classified =
      classifyFiles(
        files
      );

  }
  catch (error) {

    message.textContent =
      error.message;

    return;

  }


  createButton.disabled =
    true;


  const uploadedPaths =
    [];

  let createdBookId =
    null;


  try {

    /*
     * =====================================================
     * PDF
     * =====================================================
     *
     * PDFはPDFそのものを保存する。
     * book_pagesは不要。
     *
     * Viewer側でPDF.jsを使用する。
     */

    if (
      classified.pdfFiles.length === 1
    ) {

      const file =
        classified.pdfFiles[0];


      message.textContent =
        "PDFをアップロードしています。";


      const path =
        await uploadFile(
          file
        );


      uploadedPaths.push(
        path
      );


      message.textContent =
        "Bookを登録しています。";


      const {
        data,
        error
      } =
      await supabase
        .from("books")
        .insert({

          title,

          description,

          file_path:
            path,

          file_type:
            "pdf"

        })
        .select(
          "id"
        )
        .single();


      if (error) {

        throw new Error(
          "Book登録に失敗しました: " +
          error.message
        );

      }


      createdBookId =
        data.id;

    }


    /*
     * =====================================================
     * 複数画像
     * =====================================================
     */

    else {

      message.textContent =
        "Bookを登録しています。";


      const {
        data,
        error
      } =
      await supabase
        .from("books")
        .insert({

          title,

          description,

          file_path:
            null,

          file_type:
            "images"

        })
        .select(
          "id"
        )
        .single();


      if (error) {

        throw new Error(
          "Book登録に失敗しました: " +
          error.message
        );

      }


      createdBookId =
        data.id;


      const pageRows =
        [];


      for (
        let index = 0;
        index <
        classified.imageFiles.length;
        index++
      ) {

        const file =
          classified.imageFiles[
            index
          ];


        message.textContent =
          `画像 ${index + 1} / ${classified.imageFiles.length} をアップロードしています。`;


        const path =
          await uploadFile(
            file
          );


        uploadedPaths.push(
          path
        );


        const extension =
          file.name
            .split(".")
            .pop()
            .toLowerCase();


        pageRows.push({

          book_id:
            createdBookId,

          page_number:
            index + 1,

          file_path:
            path,

          file_type:
            extension

        });

      }


      message.textContent =
        "ページ情報を登録しています。";


      const {
        error:
          pageError
      } =
      await supabase
        .from("book_pages")
        .insert(
          pageRows
        );


      if (pageError) {

        throw new Error(
          "ページ登録に失敗しました: " +
          pageError.message
        );

      }

    }


    clearForm();


    formCard.classList.add(
      "hidden"
    );


    message.textContent =
      "Bookを登録しました。";


    await loadBooks();

  }
  catch (error) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    /*
     * Storage cleanup
     */

    if (
      uploadedPaths.length
    ) {

      try {

        await supabase.storage
          .from("web-viewer")
          .remove(
            uploadedPaths
          );

      }
      catch (
        cleanupError
      ) {

        console.warn(
          cleanupError
        );

      }

    }


    /*
     * Book cleanup
     */

    if (
      createdBookId
    ) {

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            createdBookId
          );

      }
      catch (
        cleanupError
      ) {

        console.warn(
          cleanupError
        );

      }

    }


    message.textContent =
      error.message ||
      "Book登録に失敗しました。";

  }
  finally {

    createButton.disabled =
      false;

  }

}


/* =========================================================
   Book一覧
   ========================================================= */

async function loadBooks() {

  booksContainer.innerHTML =
    `
    <div class="book-empty">
      読み込んでいます。
    </div>
    `;


  const {
    data,
    error
  } =
  await supabase
    .from("books")
    .select(`
      id,
      title,
      description,
      file_type,
      enabled,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {
    throw error;
  }


  if (!data?.length) {

    booksContainer.innerHTML =
      `
      <div class="book-empty">
        登録されたBookはありません。
      </div>
      `;

    return;

  }


  booksContainer.innerHTML =
    data.map(
      book => {

        const type =
          String(
            book.file_type || ""
          ).toLowerCase();


        const typeLabel =
          type === "pdf"
            ? "PDF"
            : "画像";


        const status =
          book.enabled === false
            ? "停止"
            : "公開";


        return `

          <article
            class="book-admin-item">

            <div
              class="book-admin-main">

              <div
                class="book-admin-title">

                ${escapeHtml(
                  book.title
                )}

              </div>


              <div
                class="book-admin-description">

                ${escapeHtml(
                  book.description || ""
                )}

              </div>


              <div
                class="book-admin-type">

                ${typeLabel}

              </div>

            </div>


            <div
              class="book-admin-status">

              ${status}

            </div>

          </article>

        `;

      }
    ).join("");

}


/* =========================================================
   Start
   ========================================================= */

async function start() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  await loadBooks();

}


start()
.catch(
  error => {

    console.error(
      "BOOK PAGE ERROR:",
      error
    );


    booksContainer.innerHTML =
      `

      <div class="page-error">

        <h2>
          Bookを読み込めませんでした
        </h2>

        <p>
          データを取得できませんでした。
        </p>

        <button
          type="button"
          class="primary-button"
          onclick="location.reload()">

          再読み込み

        </button>

      </div>

      `;

  }
);
