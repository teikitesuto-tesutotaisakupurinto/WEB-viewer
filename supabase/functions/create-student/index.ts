import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  try {

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase環境変数が設定されていません。"
      );
    }


    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error:
            "認証が必要です。"
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );
    }


    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );


    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );


    const {
      data: {
        user
      },
      error: userError
    } =
      await supabaseAdmin.auth
        .getUser(token);


    if (
      userError ||
      !user
    ) {

      return new Response(
        JSON.stringify({
          error:
            "認証情報が正しくありません。"
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    const {
      data: adminProfile,
      error: profileError
    } =
      await supabaseAdmin
        .from("users")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .single();


    if (
      profileError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {

      return new Response(
        JSON.stringify({
          error:
            "管理者権限がありません。"
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    const body =
      await req.json();


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


    const displayName =
      String(
        body.display_name || ""
      ).trim();


    const className =
      String(
        body.class_name || ""
      ).trim();


    const studentNumber =
      String(
        body.student_number || ""
      ).trim();


    if (
      !email ||
      !password ||
      !displayName
    ) {

      return new Response(
        JSON.stringify({
          error:
            "氏名、メールアドレス、パスワードは必須です。"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    if (
      password.length < 8
    ) {

      return new Response(
        JSON.stringify({
          error:
            "パスワードは8文字以上にしてください。"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    /*
     * Supabase Authユーザー作成
     */

    const {
      data: authData,
      error: authError
    } =
      await supabaseAdmin.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true
        });


    if (authError) {

      return new Response(
        JSON.stringify({
          error:
            authError.message
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    const studentId =
      authData.user.id;


    /*
     * public.users作成
     */

    const {
      error: insertError
    } =
      await supabaseAdmin
        .from("users")
        .insert({
          id: studentId,
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

      /*
       * users登録に失敗したら
       * Authユーザーも削除
       */

      await supabaseAdmin.auth.admin
        .deleteUser(
          studentId
        );


      return new Response(
        JSON.stringify({
          error:
            insertError.message
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    return new Response(
      JSON.stringify({
        success: true,
        id: studentId
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }
    );

  }
  catch (error) {

    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Student登録に失敗しました。"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }
    );

  }

});
