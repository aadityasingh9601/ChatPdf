"use server";
import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const uploadData = async (userId: any, data: any) => {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", data);
  const res = await axios.post(
    `${process.env.BACKEND_URL}/api/upload?userId=${userId}`,
    formData,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
