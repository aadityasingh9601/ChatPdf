"use server";

import axios from "axios";
import { createClient } from "../supabase/server";

export const uploadData = async (userId: any, data: any) => {
  const supabase = createClient();
    const {
      data: { session },
    } = await (await supabase).auth.getSession();
  
  const formData = new FormData();
  formData.append("file", data);
  const res = await axios.post(
    `${process.env.BACKEND_URL}/api/upload?userId=${userId}`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    },
  );
  return {
    success: true,
    message: res.data,
  };
};
