"use server";

import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const sendQuery = async (userId: any, pdfName: any, userQuery: any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.get(
    `${process.env.BACKEND_URL}/api/userquery?userId=${userId}&pdfName=${pdfName}&query=${userQuery}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
