"use server";

import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const fetchChatData = async (chatId:any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.get(
    `${process.env.BACKEND_URL}/api/chat?chatId=${chatId}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
