"use server";
import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const deleteData = async (pdfId: any, fileName:any,userId:any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.delete(
    `${process.env.BACKEND_URL}/api/pdf?pdfId=${pdfId}&fileName=${fileName}&userId=${userId}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
