"use server";
import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const deleteData = async (pdfId: any, userId:any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.delete(
    `${process.env.BACKEND_URL}/api/pdf?pdfId=${pdfId}&userId=${userId}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
