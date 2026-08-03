"use server";

import axios from "axios";

export const uploadData = async (userId:any,data: any) => {
  const formData = new FormData();
  formData.append("file",data);
  const res = await axios.post(
    `http://localhost:8000/api/upload?userId=${userId}`,
    formData,
    {
    },
  );
  return {
    success: true,
    message: res.data,
  };
};
