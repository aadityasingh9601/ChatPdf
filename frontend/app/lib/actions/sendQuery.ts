"use server";

import axios from "axios";

export const sendQuery = async (userId: any, pdfName: any, userQuery: any) => {
  const res = await axios.get(
    `http://localhost:8000/api/userquery?userId=${userId}&pdfName=${pdfName}&query=${userQuery}`,
    {},
  );
  return {
    success: true,
    message: res.data,
  };
};
