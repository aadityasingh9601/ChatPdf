"use server";

import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const sendQuery = async (userId: any, pdfId: any, userQuery: any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.get(
    `${process.env.BACKEND_URL}/api/userquery?userId=${userId}&pdfId=${pdfId}&query=${userQuery}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
