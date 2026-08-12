"use server";

import axios from "axios";
import { createClient } from "../supabase/server";

export const newChatMessage = async (
  userId: any,
  documentId: any,
  role: any,
  content: any,
) => {
  const supabase = createClient();
  const {
    data: { session },
  } = await (await supabase).auth.getSession();
  const messageData = {
    user_id: userId,
    document_id: documentId,
    role: role,
    content: content,
  };
  //formData.append("user_id",data);
  const res = await axios.post(
    `${process.env.BACKEND_URL}/api/chat`,
    messageData,
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
