
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
      file?.name || ""
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
   * PDFと画像は混在させない。
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
   * PDFは1ファイルのみ。
   */

  if (
    pdfFiles.length > 1
  ) {

    throw new Error(
      "PDFは1ファイルだけ登録できます。"
    );

  }


  /*
   * PDF。
   */

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
   * 画像。
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
   Storage upload
   ========================================================= */

async function uploadFile(
  file
) {

  const path =
    createStoragePath(
      file
    );


  let contentType =
    String(
      file.type || ""
    );


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

async function insertBook(
  values
) {

  /*
   * description はDBで NOT NULL。
   *
   * null / undefined / その他を
   * 必ず安全な文字列に変換。
   */

  const safeDescription =
    values.description == null
      ? ""
      : String(
          values.description
        );


  /*
   * file_typeもDB制約に合わせる。
   *
   * 許可:
   * pdf
   * jpg
   * jpeg
   * png
   */

  const allowedFileTypes = [
    "pdf",
    "jpg",
    "jpeg",
    "png"
  ];


  const fileType =
    values.file_type == null
      ? null
      : String(
          values.file_type
        )
          .trim()
          .toLowerCase();


  if (
    fileType !== null &&
    !allowedFileTypes.includes(
      fileType
    )
  ) {

    throw new Error(
      `file_type "${fileType}" は登録できません。`
    );

  }


  const safeValues = {

    ...values,

    description:
      safeDescription,

    file_type:
      fileType

  };


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
   Rollback Book
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
   Rollback Pages
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


    bookId =
      await insertBook({

        title:
          title,

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
     * DBのCHECK制約に合わせる。
     *
     * images は不可。
     *
     * 最初の画像の形式を
     * 親Bookのfile_typeにする。
     */

    const firstExtension =
      getExtension(
        files[0]
      );


    if (
      ![
        "jpg",
        "jpeg",
        "png"
      ].includes(
        firstExtension
      )
    ) {

      throw new Error(
        "画像形式が正しくありません。"
      );

    }


    bookId =
      await insertBook({

        title:
          title,

        description:
          description || "",

        /*
         * 画像本体はbook_pagesへ。
         */

        file_path:
          null,

        /*
         * books.file_typeには
         * imagesを入れない。
         */

        file_type:
          firstExtension,

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


      const extension =
        getExtension(
          file
        );


      if (
        ![
          "jpg",
          "jpeg",
          "png"
        ].includes(
          extension
        )
      ) {

        throw new Error(
          "対応していない画像形式があります。"
        );

      }


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
          extension

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

    await deleteBookPages(
      bookId
    );


    await deleteBook(
      bookId
    );


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
    String(
      titleInput?.value || ""
    )
      .trim();


  /*
   * NOT NULL対応。
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


  if (createButton) {

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

    if (createButton) {

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


  if (
    !data ||
    !data.length
  ) {

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


          let typeLabel =
            fileType;


          if (
            fileType === "pdf"
          ) {

            typeLabel =
              "PDF";

          }
          else if (
            [
              "jpg",
              "jpeg",
              "png"
            ].includes(
              fileType
            )
          ) {

            typeLabel =
              "画像";

          }


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
