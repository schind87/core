import axios from "axios";

const BASE_URL = "https://api.mealviewer.com/api/v4";

interface MenuItem {
  item_Name: string;
  item_Type: string;
}

interface MenuBlock {
  blockName: string;
  cafeteriaLineList: {
    data: Array<{
      foodItemList: {
        data: MenuItem[];
      };
    }>;
  };
}

interface MenuSchedule {
  dateInformation: {
    dateFull: string;
  };
  menuBlocks: MenuBlock[];
}

interface MenuResponse {
  menuSchedules: MenuSchedule[];
}

export async function fetchMenuData() {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const startDateStr = `${
    today.getMonth() + 1
  }-${today.getDate()}-${today.getFullYear()}`;
  const endDateStr = `${
    endDate.getMonth() + 1
  }-${endDate.getDate()}-${endDate.getFullYear()}`;

  const url = `${BASE_URL}/school/LokerSchool/${startDateStr}/${endDateStr}/0`;
  console.log("Fetching menu data from:", url);

  try {
    const response = await axios.get<MenuResponse>(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    if (!response.data?.menuSchedules) {
      throw new Error("No menu schedules found in the response");
    }

    // Transform the data into a simpler format
    const processedMenus = response.data.menuSchedules.map((schedule) => {
      const menuItems = schedule.menuBlocks.flatMap((block) =>
        block.cafeteriaLineList.data.flatMap((line) =>
          line.foodItemList.data
            .filter((item) => item.item_Type.toUpperCase() === "ENTREES")
            .map((item) => item.item_Name),
        ),
      );

      return {
        date: schedule.dateInformation.dateFull.split("T")[0],
        items: menuItems,
      };
    });

    return processedMenus;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("API Error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url,
      });
    }
    console.error("Error fetching menu data:", error);
    throw error;
  }
}
