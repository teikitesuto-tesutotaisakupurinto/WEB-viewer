
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


function escapeHtml(
  value
) {

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

  if (titleInput) {

    titleInput.value =
      "";

  }


  if (descriptionInput) {

    descriptionInput.value =
      "";

  }


  if (fileInput) {

    fileInput.value =
      "";

  }


  if (filePreview) {

    filePreview.innerHTML =
      "";

  }


  clearMessage();

}


if (showFormButton) {

  showFormButton.addEventListener(
    "click",
    () => {

      if (formCard) {

        formCard.classList.remove(
          "hidden"
        );

      }


      clearMessage();

    }
  );

}


if (cancelButton) {

  cancelButton.addEventListener(
    "click",
    () => {

      clearForm();


      if (formCard) {

        formCard.classList.add(
          "hidden"
        );

      }

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

function isPdf(
  file
) {

  return (
    file.type ===
      "application/pdf" ||
    /\.pdf$/i.test(
      file.name
    )
  );

}


function isImage(
  file
) {

  return (
    /^image\/(jpeg|png)$/i.test(
      file.type
    ) ||
    /\.(jpg|jpeg|png)$/i.test(
      file.name
    )
  );

}


function getExtension(
  file
) {

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
   Validate
   ========================================================= */

function validateFiles(
  files
) {

  if (
    !files.length
  ) {

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


  if (
    unsupported.length
  ) {

    throw new Error(
      "PDF、JPG、JPEG、PNGのみ登録できます。"
    );

  }


  /*
   * PDFと画像を混在させない。
   */

  if (
    pdfFiles.length &&
    imageFiles.length
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
   * 画像Bookは複数登録可能。
   */

  if (
    imageFiles.length
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

  if (!filePreview) {
    return;
  }


  filePreview.innerHTML =
    "";


  const files =
    Array.from(
      fileInput?.files || []
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


        const objectUrl =
          URL.createObjectURL(
            file
          );


        image.src =
          objectUrl;


        image.alt =
          "";


        image.onload =
          () => {

            URL.revokeObjectURL(
              objectUrl
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


if (fileInput) {

  fileInput.addEventListener(
    "change",
    renderFilePreview
  );

}


/* =========================================================
   Storage path
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


/* =========================================================
   Upload
   ========================================================= */

async function uploadFile(
  file
) {

  const path =
    createStoragePath(
      file
    );


  let contentType =
    file.type ||
    "";


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

  const validPaths =
    paths.filter(
      Boolean
    );


  if (
    !validPaths.length
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
          validPaths
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
   Book INSERT
   ========================================================= */

/*
 * ここが重要。
 *
 * description が
 *
 * undefined
 * null
 * 空文字
 *
 * のどれでも、DBへは必ず ""
 * を送る。
 */

async function insertBook(
  values
) {

  const safeValues = {

    ...values,

    description:
      values.description == null
        ? ""
        : String(
            values.description
          )

  };


  /*
   * 念のため、undefinedも
   * 空文字へ統一。
   */

  if (
    typeof safeValues.description ===
    "undefined"
  ) {

    safeValues.description =
      "";

  }


  console.log(
    "BOOK INSERT VALUES:",
    safeValues
  );


  const {
    data,
    error
  } =
    await supabase
      .from("books")
      .insert(
        safeValues
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


  if (
    !data?.id
  ) {

    throw new Error(
      "Book IDを取得できませんでした。"
    );

  }


  return data.id;

}


/* =========================================================
   Book DELETE rollback
   ========================================================= */

async function deleteBook(
  bookId
) {

  if (!bookId) {
    return;
  }


  try {

    const {
      error
    } =
      await supabase
        .from("books")
        .delete()
        .eq(
          "id",
          bookId
        );


    if (error) {

      console.warn(
        "BOOK ROLLBACK ERROR:",
        error
      );

    }

  }
  catch (
    error
  ) {

    console.warn(
      "BOOK ROLLBACK ERROR:",
      error
    );

  }

}


/* =========================================================
   Page DELETE rollback
   ========================================================= */

async function deleteBookPages(
  bookId
) {

  if (!bookId) {
    return;
  }


  try {

    const {
      error
    } =
      await supabase
        .from("book_pages")
        .delete()
        .eq(
          "book_id",
          bookId
        );


    if (error) {

      console.warn(
        "BOOK PAGES ROLLBACK ERROR:",
        error
      );

    }

  }
  catch (
    error
  ) {

    console.warn(
      "BOOK PAGES ROLLBACK ERROR:",
      error
    );

  }

}


/* =========================================================
   PDF Book
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


    bookId =
      await insertBook({

        title:
          title,

        /*
         * null禁止。
         */

        description:
          description || "",

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

    await deleteBook(
      bookId
    );


    await cleanupStorage(
      [
        storagePath
      ]
    );


    throw error;

  }

}


/* =========================================================
   Image Book
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
     * 画像Bookもdescriptionは
     * 必ず文字列。
     */

    bookId =
      await insertBook({

        title:
          title,

        description:
          description || "",

        /*
         * 画像Bookはページ側に
         * ファイルを持つ。
         */

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
     * ページを削除。
     */

    await deleteBookPages(
      bookId
    );


    /*
     * Bookを削除。
     */

    await deleteBook(
      bookId
    );


    /*
     * Storageを削除。
     */

    await cleanupStorage(
      uploadedPaths
    );


    throw error;

  }

}


/* =========================================================
   Create
   ========================================================= */

async function createBook() {

  const admin =
    await requireAdmin();


  if (!admin) {
    return;
  }


  const title =
    String(
      titleInput?.value || ""
    )
      .trim();


  /*
   * DBがNOT NULLなので、
   * nullには絶対にしない。
   */

  const description =
    String(
      descriptionInput?.value || ""
    )
      .trim();


  const files =
    Array.from(
      fileInput?.files || []
    );


  if (!title) {

    setMessage(
      "Book名を入力してください。",
      true
    );


    titleInput?.focus();


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


  if (
    createButton
  ) {

    createButton.disabled =
      true;

  }


  clearMessage();


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


    if (formCard) {

      formCard.classList.add(
        "hidden"
      );

    }


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

    if (
      createButton
    ) {

      createButton.disabled =
        false;

    }

  }

}


if (createButton) {

  createButton.addEventListener(
    "click",
    createBook
  );

}


/* =========================================================
   Book list
   ========================================================= */

async function loadBooks() {

  if (!booksContainer) {
    return;
  }


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
        file_path,
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

          const fileType =
            String(
              book.file_type || ""
            )
              .toLowerCase();


          const typeLabel =
            fileType === "pdf"
              ? "PDF"
              : (
                  fileType === "images"
                    ? "画像"
                    : fileType.toUpperCase()
                );


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

                  ${escapeHtml(
                    typeLabel
                  )}

                </div>

              </div>

              <div
                class="book-admin-status">

                ${escapeHtml(
                  status
                )}

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
