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


const parameters =
  new URLSearchParams(
    location.search
  );


const bookId =
  parameters.get("book");


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
    "Unauthorized"
  );
}


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


const {
  data: pages,
  error: pagesError
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
  pagesError ||
  !pages ||
  pages.length === 0
) {

  alert(
    "教材ページが登録されていません。"
  );

  throw new Error(
    "No pages"
  );
}


let pageIndex = 0;
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

const container =
  document.getElementById(
    "pageContainer"
  );


async function getFileUrl(path) {

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


  return data.signedUrl;

}


async function render() {

  const page =
    pages[pageIndex];


  const url =
    await getFileUrl(
      page.file_path
    );


  pdfCanvas.style.display =
    "none";

  imagePage.style.display =
    "none";


  if (
    page.file_type ===
    "jpg" ||
    page.file_type ===
    "jpeg" ||
    page.file_type ===
    "png"
  ) {

    await renderImage(
      url
    );

  }
  else {

    await renderPdf(
      url
    );

  }


  document.getElementById(
    "page"
  ).textContent =
    `${pageIndex + 1} / ${pages.length}`;


  document.getElementById(
    "zoom"
  ).textContent =
    `${Math.round(zoom * 100)}%`;


  await loadAnnotation();

}


async function renderImage(url) {

  const image =
    new Image();


  await new Promise(
    (resolve, reject) => {

      image.onload =
        resolve;

      image.onerror =
        reject;

      image.src = url;

    }
  );


  const width =
    image.naturalWidth * zoom;

  const height =
    image.naturalHeight * zoom;


  imagePage.src = url;

  imagePage.width =
    width;

  imagePage.height =
    height;

  imagePage.style.display =
    "block";


  container.style.width =
    width + "px";

  container.style.height =
    height + "px";


  setupAnnotationCanvas(
    width,
    height
  );

}


async function renderPdf(url) {

  const pdfjs =
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs"
    );


  const pdf =
    await pdfjs
      .getDocument(url)
      .promise;


  const pdfPage =
    await pdf.getPage(1);


  const viewport =
    pdfPage.getViewport({
      scale: zoom
    });


  pdfCanvas.width =
    viewport.width;

  pdfCanvas.height =
    viewport.height;


  container.style.width =
    viewport.width + "px";

  container.style.height =
    viewport.height + "px";


  await pdfPage.render({
    canvasContext:
      pdfCanvas.getContext(
        "2d"
      ),

    viewport
  }).promise;


  pdfCanvas.style.display =
    "block";


  setupAnnotationCanvas(
    viewport.width,
    viewport.height
  );

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


document.getElementById(
  "previous"
).onclick = async () => {

  if (
    pageIndex <= 0
  ) {

    return;

  }


  pageIndex--;

  await render();

};


document.getElementById(
  "next"
).onclick = async () => {

  if (
    pageIndex >=
    pages.length - 1
  ) {

    return;

  }


  pageIndex++;

  await render();

};


document.getElementById(
  "zoomIn"
).onclick = async () => {

  zoom =
    Math.min(
      3,
      zoom + .1
    );

  await render();

};


document.getElementById(
  "zoomOut"
).onclick = async () => {

  zoom =
    Math.max(
      .5,
      zoom - .1
    );

  await render();

};


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

        context.lineWidth = 16;

        context.strokeStyle =
          "rgba(255,235,0,.45)";

        context.globalCompositeOperation =
          "source-over";

      }
      else if (
        tool === "eraser"
      ) {

        context.lineWidth = 24;

        context.globalCompositeOperation =
          "destination-out";

      }
      else {

        context.lineWidth = 3;

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


annotationCanvas
  .addEventListener(
    "pointerup",
    async () => {

      drawing = false;

      await saveAnnotation();

    }
  );


async function saveAnnotation() {

  const data =
    annotationCanvas.toDataURL(
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
          pages[pageIndex]
            .page_number,

        annotation_data:
          {
            image: data,
            width:
              annotationCanvas.width,
            height:
              annotationCanvas.height
          },

        updated_at:
          new Date().toISOString()
      },
      {
        onConflict:
          "student_id,book_id,page_number"
      }
    );

}


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
        pages[pageIndex]
          .page_number
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


document.getElementById(
  "close"
).onclick = () => {

  location.replace(
    "../"
  );

};


render();
