import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};


function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json"
      }
    }
  );

}


Deno.serve(async (req) => {

  /*
   * CORS preflight
   */

  if (
    req.method === "OPTIONS"
  ) {

    return new Response(
      null,
      {
        status: 204,
        headers: corsHeaders
      }
    );

  }


  if (
    req.method !== "POST"
  ) {

    return jsonResponse(
      {
        error:
          "POST only"
      },
      405
    );

  }


  try {

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );


    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );


    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {

      console.error(
        "Supabase environment variables are missing."
      );


      return jsonResponse(
        {
          error:
            "Supabaseの環境設定がありません。"
        },
        500
      );

    }


    /*
     * Authorization
     */

    const authorization =
      req.headers.get(
        "Authorization"
      );


    if (!authorization) {

      return jsonResponse(
        {
          error:
            "ログインが必要です。"
        },
        401
      );

    }


    const token =
      authorization.replace(
        /^Bearer\s+/i,
        ""
      );


    /*
     * 管理者権限用クライアント
     */

    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false
          }
        }
      );


    /*
     * ログインユーザー確認
     */

    const {
      data: userData,
      error: userError
    } =
      await adminClient.auth
        .getUser(token);


    if (
      userError ||
      !userData.user
    ) {

      console.error(
        "AUTH ERROR:",
        userError
      );


      return jsonResponse(
        {
          error:
            "ログイン情報を確認できません。"
        },
        401
      );

    }


    /*
     * Admin確認
     */

    const {
      data: adminProfile,
      error: adminError
    } =
      await adminClient
        .from("users")
        .select("role")
        .eq(
          "id",
          userData.user.id
        )
        .maybeSingle();


    if (adminError) {

      console.error(
        "ADMIN PROFILE ERROR:",
        adminError
      );


      return jsonResponse(
        {
          error:
            adminError.message
        },
        500
      );

    }


    if (
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {

      return jsonResponse(
        {
          error:
            "管理者権限がありません。"
        },
        403
      );

    }


    /*
     * 入力
     */

    const body =
      await req.json();


    const displayName =
      String(
        body.display_name || ""
      ).trim();


    const email =
      String(
        body.email || ""
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body.password || ""
      );


    const className =
      String(
        body.class_name || ""
      ).trim();


    const studentNumber =
      String(
        body.student_number || ""
      ).trim();


    if (
      !displayName ||
      !email ||
      !password
    ) {

      return jsonResponse(
        {
          error:
            "氏名、メールアドレス、パスワードは必須です。"
        },
        400
      );

    }


    if (
      password.length < 8
    ) {

      return jsonResponse(
        {
          error:
            "パスワードは8文字以上にしてください。"
        },
        400
      );

    }


    /*
     * Authユーザー作成
     */

    const {
      data: created,
      error: createError
    } =
      await adminClient.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true
        });


    if (
      createError ||
      !created.user
    ) {

      console.error(
        "CREATE USER ERROR:",
        createError
      );


      return jsonResponse(
        {
          error:
            createError?.message ||
            "Studentアカウントを作成できませんでした。"
        },
        400
      );

    }


    const studentId =
      created.user.id;


    /*
     * users登録
     */

    const {
      error: insertError
    } =
      await adminClient
        .from("users")
        .insert({
          id:
            studentId,

          display_name:
            displayName,

          role:
            "student",

          class_name:
            className,

          student_number:
            studentNumber
        });


    if (insertError) {

      console.error(
        "USERS INSERT ERROR:",
        insertError
      );


      await adminClient.auth.admin
        .deleteUser(
          studentId
        );


      return jsonResponse(
        {
          error:
            insertError.message
        },
        400
      );

    }


    return jsonResponse({
      success: true,
      id: studentId
    });

  }
  catch (error) {

    console.error(
      "FUNCTION ERROR:",
      error
    );


    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Student登録に失敗しました。"
      },
      500
    );

  }

});
