import {
  requireStudent
}
from "../../assets/js/auth.js";

import {
  supabase
}
from "../../assets/js/supabase.js";


const student =
  await requireStudent();

if (!student) {
  throw new Error("Unauthorized");
}


const params =
  new URLSearchParams(
    location.search
  );


const bookId =
  params.get("book");


if (!bookId) {

  alert(
    "Bookが指定されていません。"
  );

  location.replace(
    "../"
  );

  throw new Error(
    "Book ID missing"
  );
}


/*
 * StudentがこのBookを
 * 利用できるか確認
 */

const {
  data: license,
  error: licenseError
} =
  await supabase
    .from("licenses")
    .select("id")
    .eq(
      "book_id",
      bookId
    )
    .eq(
      "student_id",
      student.id
    )
    .eq(
      "status",
      "used"
    )
    .maybeSingle();


if (
  licenseError ||
  !license
) {

  alert(
    "このBookを利用する権限がありません。"
  );

  location.replace(
    "../"
  );

  throw new Error(
    "Book access denied"
  );
}


/*
 * Book取得
 */

const {
  data: book,
  error: bookError
} =
  await supabase
    .from("books")
    .select("*")
    .eq(
      "id",
      bookId
    )
    .eq(
      "enabled",
      true
    )
    .single();


if (
  bookError ||
  !book
) {

  alert(
    "Bookが見つかりません。"
  );

  throw new Error(
    "Book not found"
  );
}


document.getElementById(
  "title"
).textContent =
  book.title;


/*
 * PDFか画像か判定
 */

const isPdf =
  book.file_type === "pdf";


let imagePages = [];


/*
 * 画像Bookの場合
 */

if (!isPdf) {

  const {
    data,
    error
  } =
    await supabase
      .from("book_pages")
      .select("*")
      .eq(
        "book_id",
        bookId
      )
      .order(
        "page_number",
        {
          ascending: true
        }
      );


  if (
    error ||
    !data ||
    data.length === 0
  ) {

    alert(
      "画像ページが登録されていません。"
    );

    throw new Error(
      "Image pages not found"
    );
  }


  imagePages = data;

}


/*
 * 状態
 */

let pdf = null;

let currentPage = 1;

let zoom = 1;

let tool = "pen";

let drawing = false;

let lastX = 0;

let lastY = 0;


const pdfCanvas =
  document.getElementById(
    "pdfCanvas"
  );

const imagePage =
  document.getElementById(
    "imagePage"
  );

const annotationCanvas =
  document.getElementById(
    "annotationCanvas"
  );

const pageContainer =
  document.getElementById(
    "pageContainer"
  );


/*
 * PDF URL
 */

async function getSignedUrl(
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


  if (error) {
    throw error;
  }


  return data.signedUrl;
}


/*
 * PDF読み込み
 */

async function loadPdf() {

  const url =
    await getSignedUrl(
      book.file_path
    );


  const pdfjs =
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs"
    );


  pdf =
    await pdfjs
      .getDocument(url)
      .promise;


  await renderPdfPage();

}


/*
 * PDFページ表示
 */

async function renderPdfPage() {

  const page =
    await pdf.getPage(
      currentPage
    );


  const viewport =
    page.getViewport({
      scale: zoom
    });


  pdfCanvas.width =
    viewport.width;

  pdfCanvas.height =
    viewport.height;


  pageContainer.style.width =
    viewport.width + "px";

  pageContainer.style.height =
    viewport.height + "px";


  await page.render({
    canvasContext:
      pdfCanvas.getContext("2d"),

    viewport
  }).promise;


  pdfCanvas.style.display =
    "block";

  imagePage.style.display =
    "none";


  setupAnnotationCanvas(
    viewport.width,
    viewport.height
  );


  updatePageInfo();


  await loadAnnotation();

}


/*
 * 画像ページ表示
 */

async function renderImagePage() {

  const page =
    imagePages[
      currentPage - 1
    ];


  const url =
    await getSignedUrl(
      page.file_path
    );


  const image =
    new Image();


  await new Promise(
    (resolve, reject) => {

      image.onload =
        resolve;

      image.onerror =
        reject;

      image.src =
        url;

    }
  );


  const width =
    image.naturalWidth *
    zoom;

  const height =
    image.naturalHeight *
    zoom;


  imagePage.src =
    url;

  imagePage.width =
    width;

  imagePage.height =
    height;


  imagePage.style.display =
    "block";

  pdfCanvas.style.display =
    "none";


  pageContainer.style.width =
    width + "px";

  pageContainer.style.height =
    height + "px";


  setupAnnotationCanvas(
    width,
    height
  );


  updatePageInfo();


  await loadAnnotation();

}


/*
 * 初期表示
 */

async function render() {

  if (isPdf) {

    await loadPdf();

  } else {

    await renderImagePage();

  }

}


function setupAnnotationCanvas(
  width,
  height
) {

  annotationCanvas.width =
    width;

  annotationCanvas.height =
    height;

  annotationCanvas.style.width =
    width + "px";

  annotationCanvas.style.height =
    height + "px";

}


function getPageCount() {

  if (isPdf) {

    return pdf
      ? pdf.numPages
      : 0;

  }


  return imagePages.length;

}


function updatePageInfo() {

  document.getElementById(
    "page"
  ).textContent =
    `${currentPage} / ${getPageCount()}`;


  document.getElementById(
    "zoom"
  ).textContent =
    `${Math.round(zoom * 100)}%`;

}


/*
 * 前ページ
 */

document.getElementById(
  "previous"
).onclick = async () => {

  if (currentPage <= 1) {
    return;
  }


  await saveAnnotation();


  currentPage--;

  await render();

};


/*
 * 次ページ
 */

document.getElementById(
  "next"
).onclick = async () => {

  if (
    currentPage >=
    getPageCount()
  ) {

    return;
  }


  await saveAnnotation();


  currentPage++;

  await render();

};


/*
 * 拡大
 */

document.getElementById(
  "zoomIn"
).onclick = async () => {

  await saveAnnotation();


  zoom =
    Math.min(
      3,
      zoom + .1
    );


  await render();

};


/*
 * 縮小
 */

document.getElementById(
  "zoomOut"
).onclick = async () => {

  await saveAnnotation();


  zoom =
    Math.max(
      .5,
      zoom - .1
    );


  await render();

};


/*
 * ツール
 */

document.getElementById(
  "pen"
).onclick = () => {

  tool = "pen";

};


document.getElementById(
  "highlighter"
).onclick = () => {

  tool = "highlighter";

};


document.getElementById(
  "eraser"
).onclick = () => {

  tool = "eraser";

};


/*
 * ページ消去
 */

document.getElementById(
  "clear"
).onclick = async () => {

  const context =
    annotationCanvas
      .getContext("2d");


  context.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );


  await saveAnnotation();

};


/*
 * 手書き開始
 */

annotationCanvas
  .addEventListener(
    "pointerdown",
    event => {

      drawing = true;


      const rect =
        annotationCanvas
          .getBoundingClientRect();


      lastX =
        event.clientX -
        rect.left;

      lastY =
        event.clientY -
        rect.top;


      annotationCanvas
        .setPointerCapture(
          event.pointerId
        );

    }
  );


/*
 * 手書き
 */

annotationCanvas
  .addEventListener(
    "pointermove",
    event => {

      if (!drawing) {
        return;
      }


      const rect =
        annotationCanvas
          .getBoundingClientRect();


      const x =
        event.clientX -
        rect.left;

      const y =
        event.clientY -
        rect.top;


      const context =
        annotationCanvas
          .getContext("2d");


      context.beginPath();

      context.moveTo(
        lastX,
        lastY
      );

      context.lineTo(
        x,
        y
      );


      context.lineCap =
        "round";


      if (
        tool === "highlighter"
      ) {

        context.lineWidth =
          16;

        context.strokeStyle =
          "rgba(255,235,0,.45)";

        context.globalCompositeOperation =
          "source-over";

      }
      else if (
        tool === "eraser"
      ) {

        context.lineWidth =
          24;

        context.globalCompositeOperation =
          "destination-out";

      }
      else {

        context.lineWidth =
          3;

        context.strokeStyle =
          "#111";

        context.globalCompositeOperation =
          "source-over";

      }


      context.stroke();


      lastX = x;

      lastY = y;

    }
  );


/*
 * 手書き終了
 */

annotationCanvas
  .addEventListener(
    "pointerup",
    async () => {

      drawing = false;

      await saveAnnotation();

    }
  );


/*
 * 書き込み保存
 */

async function saveAnnotation() {

  const image =
    annotationCanvas
      .toDataURL(
        "image/png"
      );


  await supabase
    .from("annotations")
    .upsert(
      {
        student_id:
          student.id,

        book_id:
          bookId,

        page_number:
          currentPage,

        annotation_data: {
          image,

          width:
            annotationCanvas.width,

          height:
            annotationCanvas.height
        },

        updated_at:
          new Date()
            .toISOString()
      },
      {
        onConflict:
          "student_id,book_id,page_number"
      }
    );

}


/*
 * 書き込み読み込み
 */

async function loadAnnotation() {

  const {
    data,
    error
  } =
    await supabase
      .from("annotations")
      .select(
        "annotation_data"
      )
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "book_id",
        bookId
      )
      .eq(
        "page_number",
        currentPage
      )
      .maybeSingle();


  const context =
    annotationCanvas
      .getContext("2d");


  context.clearRect(
    0,
    0,
    annotationCanvas.width,
    annotationCanvas.height
  );


  if (
    error ||
    !data ||
    !data.annotation_data ||
    !data.annotation_data.image
  ) {

    return;

  }


  const image =
    new Image();


  image.onload = () => {

    context.drawImage(
      image,
      0,
      0,
      annotationCanvas.width,
      annotationCanvas.height
    );

  };


  image.src =
    data.annotation_data.image;

}


/*
 * 閉じる
 */

document.getElementById(
  "close"
).onclick = async () => {

  await saveAnnotation();

  location.replace(
    "../"
  );

};


render();
