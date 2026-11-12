
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
  document.getElementById(
    "formCard"
  );

const titleInput =
  document.getElementById(
    "title"
  );

const descriptionInput =
  document.getElementById(
    "description"
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

const messageElement =
  document.getElementById(
    "message"
  );

const booksContainer =
  document.getElementById(
    "books"
  );


/* =========================================================
   Logout
   ========================================================= */

const logoutButton =
  document.getElementById(
    "logout"
  );


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
   Form
   ========================================================= */

const showFormButton =
  document.getElementById(
    "showForm"
  );


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


const cancelButton =
  document.getElementById(
    "cancel"
  );


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


if (fileInput) {

  fileInput.addEventListener(
    "change",
    renderFilePreview
  );

}


/* =========================================================
   Message
   ========================================================= */

function setMessage(
  text,
  error = false
) {

  if (!messageElement) {
    return;
  }


  messageElement.textContent =
    text;


  messageElement.dataset.error =
    error
      ? "true"
      : "false";

}


function clearMessage() {

  setMessage(
    ""
  );

}


/* =========================================================
   Form clear
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


/* =========================================================
   Validate
   ========================================================= */

function validateFiles(
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


  if (
    pdfFiles.length > 0 &&
    imageFiles.length > 0
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


  if (
    !pdfFiles.length &&
    !imageFiles.length
  ) {

    throw new Error(
      "登録できるファイルがありません。"
    );

  }


  return {

    type:
      pdfFiles.length
        ? "pdf"
        : "images",

    files:
      pdfFiles.length
        ? pdfFiles
        : imageFiles

  };

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


/* =========================================================
   Storage path
   ========================================================= */

function getExtension(
  file
) {

  const name =
    file.name || "";


  const parts =
    name.split(".");


  return (
    parts.length > 1
      ? parts.pop()
      : ""
  )
    .toLowerCase();

}


function createStoragePath(
  file
) {

  const extension =
    getExtension(
      file
    );


  return (
    `books/` +
    `${crypto.randomUUID()}` +
    `${extension ? "." + extension : ""}`
  );

}


/* =========================================================
   Upload
   ========================================================= */

async function uploadBookFile(
  file
) {

  const path =
    createStoragePath(
      file
    );


  const contentType =
    isPdf(file)
      ? "application/pdf"
      : (
          file.type ||
          (
            getExtension(file) ===
            "png"
              ? "image/png"
              : "image/jpeg"
          )
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
      `ファイルのアップロードに失敗しました。${error.message || ""}`
    );

  }


  return path;

}


/* =========================================================
   Storage cleanup
   ========================================================= */

async function removeStorageFiles(
  paths
) {

  if (!paths.length) {
    return;
  }


  try {

    await supabase.storage
      .from("web-viewer")
      .remove(
        paths
      );

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
   Book insert
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
      `Book登録に失敗しました。${error.message || ""}`
    );

  }


  return data.id;

}


/* =========================================================
   Image pages insert
   ========================================================= */

async function insertPages(
  bookIdValue,
  rows
) {

  const {
    error
  } =
    await supabase
      .from("book_pages")
      .insert(
        rows
      );


  if (error) {

    console.error(
      "BOOK PAGES INSERT ERROR:",
      error
    );


    throw new Error(
      `ページ登録に失敗しました。${error.message || ""}`
    );

  }

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

  let createdBookId =
    null;


  try {

    setMessage(
      "PDFをアップロードしています。"
    );


    storagePath =
      await uploadBookFile(
        file
      );


    setMessage(
      "Book情報を登録しています。"
    );


    createdBookId =
      await insertBook({

        title,

        description:
          description || null,

        file_path:
          storagePath,

        file_type:
          "pdf",

        enabled:
          true

      });


    return createdBookId;

  }
  catch (
    error
  ) {

    if (createdBookId) {

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            createdBookId
          );

      }
      catch {}

    }


    if (storagePath) {

      await removeStorageFiles(
        [storagePath]
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

  let createdBookId =
    null;

  const uploadedPaths =
    [];


  try {

    setMessage(
      "Book情報を登録しています。"
    );


    createdBookId =
      await insertBook({

        title,

        description:
          description || null,

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
        await uploadBookFile(
          file
        );


      uploadedPaths.push(
        path
      );


      pageRows.push({

        book_id:
          createdBookId,

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


    await insertPages(
      createdBookId,
      pageRows
    );


    return createdBookId;

  }
  catch (
    error
  ) {

    if (createdBookId) {

      try {

        await supabase
          .from("book_pages")
          .delete()
          .eq(
            "book_id",
            createdBookId
          );

      }
      catch {}

      try {

        await supabase
          .from("books")
          .delete()
          .eq(
            "id",
            createdBookId
          );

      }
      catch {}

    }


    await removeStorageFiles(
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
    titleInput.value.trim();


  const description =
    descriptionInput.value.trim();


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
      "CREATE BOOK ERROR:",
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
   HTML escape
   ========================================================= */

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
      `Book一覧を取得できませんでした。${error.message || ""}`
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


      booksContainer.innerHTML =
        `
          <div class="book-empty">

            Bookを読み込めませんでした。

          </div>
        `;

    }
  );
