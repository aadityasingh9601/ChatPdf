"use server";

import axios from "axios";
import { createClient } from "../supabase/server";

export const fetchData = async (userId: any) => {
  const supabase = createClient();
  const {
    data: { session },
  } = await (await supabase).auth.getSession();

  const res = await axios.get(
    `${process.env.BACKEND_URL}/api/getpdfs?userId=${userId}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    },
  );
  return {
    success: true,
    message: res.data,
  };
};
