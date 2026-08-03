"use server";

import axios from "axios";

export const deleteData = async (pdfId: any, fileName:any,userId:any) => {
  const res = await axios.delete(
    `http://localhost:8000/api/pdf?pdfId=${pdfId}&fileName=${fileName}&userId=${userId}`,
    {},
  );
  return {
    success: true,
    message: res.data,
  };
};
