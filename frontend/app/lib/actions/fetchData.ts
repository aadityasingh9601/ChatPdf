"use server";

import axios from "axios";
import { getAuthHeaders } from "../utils/getSession";

export const fetchData = async (userId: any) => {
  const authHeaders = await getAuthHeaders();
  const res = await axios.get(
    `${process.env.BACKEND_URL}/api/getpdfs?userId=${userId}`,
    authHeaders
  );
  return {
    success: true,
    message: res.data,
  };
};
