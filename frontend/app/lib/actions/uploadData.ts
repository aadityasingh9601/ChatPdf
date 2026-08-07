"use server";

import axios from "axios";

export const uploadData = async (userId: any, data: any) => {
  const formData = new FormData();
  formData.append("file", data);
  const res = await axios.post(`${process.env.BACKEND_URL}/api/upload?userId=${userId}`, formData, {});
  console.log(res);
  return {
    success: true,
    message: res.data,
  };
};
