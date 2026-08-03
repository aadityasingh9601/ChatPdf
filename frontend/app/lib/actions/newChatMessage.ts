"use server";

import axios from "axios";

export const newChatMessage = async (
  userId: any,
  documentId: any,
  role: any,
  content: any,
) => {

  const messageData = {
    user_id: userId,
    document_id: documentId,
    role: role,
    content: content,
  };
  //formData.append("user_id",data);
  const res = await axios.post(
    `http://localhost:8000/api/chat`,
    messageData,
    {},
  );
  return {
    success: true,
    message: res.data,
  };
};
