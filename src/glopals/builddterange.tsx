// import dayjs from "dayjs";

// export const buildDateRange = (
//   yearArr?: string[],
//   monthArr?: string[],
//   dayArr?: number[]
// ) => {
//   if (!yearArr || yearArr.length === 0) return {};

//   // Handle multiple years
//   const minYear = Math.min(...yearArr.map(Number)).toString();
//   const maxYear = Math.max(...yearArr.map(Number)).toString();

//   // Case: specific month(s) and day(s)
//   if (monthArr && monthArr.length && dayArr && dayArr.length) {
//     const minMonth = Math.min(...monthArr.map(Number)).toString().padStart(2, "0");
//     const maxMonth = Math.max(...monthArr.map(Number)).toString().padStart(2, "0");

//     if (dayArr.length === 1) {
//       const d = dayArr[0].toString().padStart(2, "0");
//       const startDate = `${minYear}-${minMonth}-${d}`;
//       const endDate = `${maxYear}-${maxMonth}-${d}`;
//       return { start_date: startDate, end_date: endDate };
//     } else {
//       const minDay = Math.min(...dayArr).toString().padStart(2, "0");
//       const maxDay = Math.max(...dayArr).toString().padStart(2, "0");
//       const startDate = `${minYear}-${minMonth}-${minDay}`;
//       const endDate = `${maxYear}-${maxMonth}-${maxDay}`;
//       return { start_date: startDate, end_date: endDate };
//     }
//   }

//   // Case: only month(s)
//   else if (monthArr && monthArr.length) {
//     const minMonth = Math.min(...monthArr.map(Number)).toString().padStart(2, "0");
//     const maxMonth = Math.max(...monthArr.map(Number)).toString().padStart(2, "0");

//     const startDate = `${minYear}-${minMonth}-01`;
//     const endDate = dayjs(`${maxYear}-${maxMonth}-01`)
//       .endOf("month")
//       .format("YYYY-MM-DD");

//     return { start_date: startDate, end_date: endDate };
//   }

//   // Case: only years
//   else {
//     return { start_date: `${minYear}-01-01`, end_date: `${maxYear}-12-31` };
//   }
// };





import dayjs from "dayjs";

export const buildDateRange = (
  yearArr?: string[],
  monthArr?: string[],
  dayArr?: number[]
) => {
  if (!yearArr || yearArr.length === 0) return {};

  const minYear = Math.min(...yearArr.map(Number)).toString();
  const maxYear = Math.max(...yearArr.map(Number)).toString();

  // If month is NOT selected
  if (!monthArr || monthArr.length === 0) {

    // If day is NOT selected -> full year
    if (!dayArr || dayArr.length === 0) {
      return {
        start_date: `${minYear}-01-01`,
        end_date: `${maxYear}-12-31`,
      };
    }

    // If day IS selected -> full year but selected day
    const minDay = Math.min(...dayArr).toString().padStart(2, "0");
    const maxDay = Math.max(...dayArr).toString().padStart(2, "0");

    return {
      start_date: `${minYear}-01-${minDay}`,
      end_date: `${maxYear}-12-${maxDay}`,
    };
  }

  // If month is selected
  const minMonth = Math.min(...monthArr.map(Number)).toString().padStart(2, "0");
  const maxMonth = Math.max(...monthArr.map(Number)).toString().padStart(2, "0");

  // If day is selected with month
  if (dayArr && dayArr.length) {
    const minDay = Math.min(...dayArr).toString().padStart(2, "0");
    const maxDay = Math.max(...dayArr).toString().padStart(2, "0");

    return {
      start_date: `${minYear}-${minMonth}-${minDay}`,
      end_date: `${maxYear}-${maxMonth}-${maxDay}`,
    };
  }

  // Only month selected
  const startDate = `${minYear}-${minMonth}-01`;
  const endDate = dayjs(`${maxYear}-${maxMonth}-01`).endOf("month").format("YYYY-MM-DD");

  return { start_date: startDate, end_date: endDate };
};
