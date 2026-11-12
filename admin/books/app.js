
import {
  requireAdmin,
  logout
} from "../../assets/js/auth.js";

import {
  supabase
} from "../../assets/js/supabase.js";


/* =========================================================
   DOM
   ========================================================= */

const formCard =
  document.getElementById("formCard");

const titleInput =
  document.getElementById("title");

const descriptionInput =
  document.getElementById("description");

const fileInput =
  document.getElementById("files");

const filePreview =
  document.getElementById("filePreview");

const createButton =
  document.getElementById("create");

const messageElement =
  document.getElementById("message");

const booksContainer =
  document.getElementById("books");

const showFormButton =
  document.getElementById("showForm");

const cancelButton =
  document.getElementById("cancel");

const logoutButton =
  document.getElementById("logout");


/* =========================================================
   Utility
   ========================================================= */

function setMessage(
  text,
  isError = false
) {

  if (!messageElement) {
    return;
  }

  messageElement.textContent =
    text;

  messageElement.dataset.error =
    isError
      ? "true"
      : "false";
}


function clearMessage() {

  setMessage("");

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   Form
   ========================================================= */

function clearForm() {

  titleInput.value =
    "";

  descriptionInput.value =
    "";

  fileInput.value =
    "";

  filePreview.innerHTML =
    "";

  clearMessage();

}


if (showFormButton) {

  showFormButton.addEventListener(
    "click",
    () => {

      formCard.classList.remove(
        "hidden"
      );

      clearMessage();

    }
  );

}


if (cancelButton) {

  cancelButton.addEventListener(
    "click",
    () => {

      clearForm();

      formCard.classList.add(
        "hidden"
      );

    }
  );

}


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    async event => {

      event.preventDefault();

      await logout();

    }
  );

}


/* =========================================================
   File type
   ========================================================= */

function isPdf(file) {

  return (
    file.type ===
      "application/pdf" ||
    /\.pdf$/i.test(
      file.name
    )
  );

}


function isImage(file) {

  return (
    /^image\/(jpeg|png)$/i.test(
      file.type
    ) ||
    /\.(jpg|jpeg|png)$/i.test(
      file.name
    )
  );

}


function getExtension(file) {

  const parts =
    String(
      file.name || ""
    )
      .split(".");

  if (
    parts.length < 2
  ) {

    return "";

  }

  return parts
    .pop()
    .toLowerCase();

}


/* =========================================================
   Validate files
   ========================================================= */

function validateFiles(files) {

  if (!files.length) {

    throw new Error(
      "教材ファイルを選択してください。"
    );

  }


  const pdfFiles =
    files.filter(
      file =>
        isPdf(file)
    );


  const imageFiles =
    files.filter(
      file =>
        isImage(file)
    );


  const unsupported =
    files.filter(
      file =>
        !isPdf(file) &&
        !isImage(file)
    );


  if (unsupported.length) {

    throw new Error(
      "PDF、JPG、JPEG、PNGのみ登録できます。"
    );

  }


  /*
   * PDFと画像の混在は禁止。
   */

  if (
    pdfFiles.length > 0 &&
    imageFiles.length > 0
  ) {

    throw new Error(
      "PDFと画像は同時に登録できません。"
    );

  }


  /*
   * PDFは1ファイル。
   */

  if (
    pdfFiles.length > 1
  ) {

    throw new Error(
      "PDFは1ファイルだけ登録できます。"
    );

  }


  if (
    pdfFiles.length === 1
  ) {

    return {

      type:
        "pdf",

      files:
        pdfFiles

    };

  }


  /*
   * 画像Book。
   */

  if (
    imageFiles.length > 0
  ) {

    return {

      type:
        "images",

      files:
        imageFiles

    };

  }


  throw new Error(
    "登録できるファイルがありません。"
  );

}


/* =========================================================
   Preview
   ========================================================= */

function renderFilePreview() {

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
        String(
          index + 1
        );


      item.appendChild(
        number
      );


      if (
        isImage(file)
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


        image.alt =
          "";


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


fileInput.addEventListener(
  "change",
  renderFilePreview
);


/* =========================================================
   Storage
   ========================================================= */

function createStoragePath(
  file
) {

  const extension =
    getExtension(file);


  return (
    "books/" +
    crypto.randomUUID() +
    (
      extension
        ? "." + extension
        : ""
    )
  );

}


async function uploadFile(
  file
) {

  const path =
    createStoragePath(
      file
    );


  let contentType =
    file.type;


  if (!contentType) {

    if (
      isPdf(file)
    ) {

      contentType =
        "application/pdf";

    }
    else if (
      getExtension(file) ===
      "png"
    ) {

      contentType =
        "image/png";

    }
    else {

      contentType =
        "image/jpeg";

    }

  }


  const {
    error
  } =
    await supabase.storage
      .from("web-viewer")
      .upload(
        path,
        file,
        {
          cacheControl:
            "3600",

          contentType,

          upsert:
            false
        }
      );


  if (error) {

    console.error(
      "STORAGE UPLOAD ERROR:",
      error
    );

    throw new Error(
      "ファイルのアップロードに失敗しました。\n" +
      error.message
    );

  }


  return path;

}


/* =========================================================
   Storage cleanup
   ========================================================= */

async function cleanupStorage(
  paths
) {

  if (
    !paths.length
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabase.storage
        .from("web-viewer")
        .remove(
          paths
        );


    if (error) {

      console.warn(
        "STORAGE CLEANUP ERROR:",
        error
      );

    }

  }
  catch (
    error
  ) {

    console.warn(
      "STORAGE CLEANUP ERROR:",
      error
    );

  }

}


/* =========================================================
   Create books row
   ========================================================= */

async function insertBook(
  values
) {

  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .insert(
        values
      )
      .select(
        "id"
      )
      .single();


  if (error) {

    console.error(
      "BOOK INSERT ERROR:",
      error
    );

    throw new Error(
      "Book登録に失敗しました。\n" +
      error.message
    );

  }


  return data.id;

}


/* =========================================================
   Create PDF Book
   ========================================================= */

async function createPdfBook(
  title,
  description,
  file
) {

  let storagePath =
    null;

  let bookId =
    null;


  try {

    setMessage(
      "PDFをアップロードしています。"
    );


    storagePath =
      await uploadFile(
        file
      );


    setMessage(
      "Book情報を登録しています。"
    );


    /*
     * descriptionはNOT NULLなので、
     * 空欄でも必ず空文字列を入れる。
     */

    bookId =
      await insertBook({

        title:
          title,

        description:
          description,

        file_path:
          storagePath,

        file_type:
          "pdf",

        enabled:
          true

      });


    return bookId;

  }
  catch (
    error
  ) {

    if (bookId) {

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            bookId
          );

      }
      catch {}

    }


    if (storagePath) {

      await cleanupStorage(
        [
          storagePath
        ]
      );

    }


    throw error;

  }

}


/* =========================================================
   Create Image Book
   ========================================================= */

async function createImageBook(
  title,
  description,
  files
) {

  let bookId =
    null;

  const uploadedPaths =
    [];


  try {

    setMessage(
      "Book情報を登録しています。"
    );


    /*
     * file_pathは画像BookではNULL。
     * descriptionだけはNOT NULLなので
     * 空文字列を必ず入れる。
     */

    bookId =
      await insertBook({

        title:
          title,

        description:
          description,

        file_path:
          null,

        file_type:
          "images",

        enabled:
          true

      });


    const pageRows =
      [];


    for (
      let index = 0;
      index < files.length;
      index++
    ) {

      const file =
        files[index];


      setMessage(
        `画像 ${index + 1} / ${files.length} をアップロードしています。`
      );


      const path =
        await uploadFile(
          file
        );


      uploadedPaths.push(
        path
      );


      pageRows.push({

        book_id:
          bookId,

        page_number:
          index + 1,

        file_path:
          path,

        file_type:
          getExtension(file)

      });

    }


    setMessage(
      "ページ情報を登録しています。"
    );


    const {
      error
    } =
      await supabase
        .from("book_pages")
        .insert(
          pageRows
        );


    if (error) {

      console.error(
        "BOOK PAGES INSERT ERROR:",
        error
      );

      throw new Error(
        "ページ登録に失敗しました。\n" +
        error.message
      );

    }


    return bookId;

  }
  catch (
    error
  ) {

    /*
     * ページ削除
     */

    if (bookId) {

      try {

        await supabase
          .from("book_pages")
          .delete()
          .eq(
            "book_id",
            bookId
          );

      }
      catch {}

    }


    /*
     * Book削除
     */

    if (bookId) {

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            bookId
          );

      }
      catch {}

    }


    /*
     * Storage削除
     */

    await cleanupStorage(
      uploadedPaths
    );


    throw error;

  }

}


/* =========================================================
   Create Book
   ========================================================= */

async function createBook() {

  const admin =
    await requireAdmin();


  if (!admin) {

    return;

  }


  const title =
    titleInput.value.trim();


  /*
   * ここが重要。
   *
   * 空欄ならnullではなく
   * ""をDBへ送る。
   */

  const description =
    descriptionInput.value.trim() ||
    "";


  const files =
    Array.from(
      fileInput.files || []
    );


  if (!title) {

    setMessage(
      "Book名を入力してください。",
      true
    );

    titleInput.focus();

    return;

  }


  let selection;


  try {

    selection =
      validateFiles(
        files
      );

  }
  catch (
    error
  ) {

    setMessage(
      error.message,
      true
    );

    return;

  }


  createButton.disabled =
    true;


  try {

    if (
      selection.type ===
      "pdf"
    ) {

      await createPdfBook(

        title,

        description,

        selection.files[0]

      );

    }
    else {

      await createImageBook(

        title,

        description,

        selection.files

      );

    }


    clearForm();


    formCard.classList.add(
      "hidden"
    );


    setMessage(
      "Bookを登録しました。"
    );


    await loadBooks();

  }
  catch (
    error
  ) {

    console.error(
      "BOOK CREATE ERROR:",
      error
    );


    setMessage(
      error.message ||
      "Book登録に失敗しました。",
      true
    );

  }
  finally {

    createButton.disabled =
      false;

  }

}


createButton.addEventListener(
  "click",
  createBook
);


/* =========================================================
   Book list
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
          ascending:
            false
        }
      );


  if (error) {

    throw new Error(
      "Book一覧を取得できませんでした。\n" +
      error.message
    );

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
    data
      .map(
        book => {

          const type =
            String(
              book.file_type || ""
            )
              .toLowerCase();


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
      )
      .join("");

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
        "BOOK ADMIN ERROR:",
        error
      );


      if (
        booksContainer
      ) {

        booksContainer.innerHTML =
          `
            <div class="book-empty">
              Bookを読み込めませんでした。
            </div>
          `;

      }

    }
  );
