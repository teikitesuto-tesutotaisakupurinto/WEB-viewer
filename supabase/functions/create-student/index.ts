import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://web-viewer-na5q.onrender.com",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json"
};


function response(
  body: Record<string, unknown>,
  status = 200
) {

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders
    }
  );

}


Deno.serve(
  async (req) => {

    if (
      req.method === "OPTIONS"
    ) {

      return new Response(
        "ok",
        {
          status: 200,
          headers: corsHeaders
        }
      );

    }


    if (
      req.method !== "POST"
    ) {

      return response(
        {
          error:
            "POSTのみ対応しています。"
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


        return response(
          {
            error:
              "Supabaseの環境設定がありません。"
          },
          500
        );

      }


      const authorization =
        req.headers.get(
          "Authorization"
        );


      if (!authorization) {

        return response(
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
          "Auth error:",
          userError
        );


        return response(
          {
            error:
              "ログイン情報を確認できません。"
          },
          401
        );

      }


      const currentUser =
        userData.user;


      const {
        data: adminProfile,
        error: adminProfileError
      } =
        await adminClient
          .from("users")
          .select("role")
          .eq(
            "id",
            currentUser.id
          )
          .maybeSingle();


      if (adminProfileError) {

        console.error(
          "Admin profile error:",
          adminProfileError
        );


        return response(
          {
            error:
              adminProfileError.message
          },
          500
        );

      }


      if (
        !adminProfile ||
        adminProfile.role !== "admin"
      ) {

        return response(
          {
            error:
              "管理者権限がありません。"
          },
          403
        );

      }


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

        return response(
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

        return response(
          {
            error:
              "パスワードは8文字以上にしてください。"
          },
          400
        );

      }


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
          "Create Auth user error:",
          createError
        );


        return response(
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
          "users insert error:",
          insertError
        );


        await adminClient.auth.admin
          .deleteUser(
            studentId
          );


        return response(
          {
            error:
              insertError.message
          },
          400
        );

      }


      return response(
        {
          success: true,
          id: studentId
        }
      );

    }
    catch (error) {

      console.error(
        "create-student error:",
        error
      );


      return response(
        {
          error:
            error instanceof Error
              ? error.message
              : "Student登録に失敗しました。"
        },
        500
      );

    }

  }
);
