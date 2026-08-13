"use server";

import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const newChatMessage = async (
  userId: any,
  documentId: any,
  role: any,
  content: any,
) => {
  const authHeaders = await getAuthHeaders();
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
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
