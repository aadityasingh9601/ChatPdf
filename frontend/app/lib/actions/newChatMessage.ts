"use server";

import axios from "axios";

export const newChatMessage = async (
  userId: any,
  documentId: any,
  role: any,
  content: any,
) => {
  console.log("User Id ->", userId);
  console.log(documentId);
  console.log(role, content);

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
  console.log(res);
  return {
    success: true,
    message: res.data,
  };
};
