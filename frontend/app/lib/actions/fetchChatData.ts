"use server";

import axios from "axios";
import { createClient } from "../supabase/server";

export const fetchChatData = async (chatId:any) => {
  const supabase = createClient();
  const {
    data: { session },
  } = await (await supabase).auth.getSession();

  const res = await axios.get(
    `/api/chat?chatId=${chatId}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    },
  );
  console.log(res?.data);
  return {
    success: true,
    message: res.data,
  };
};
