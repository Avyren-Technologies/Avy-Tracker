export interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  location: string;
  description?: string;
  date: string;
  userId: number;
}

export interface CalendarTheme {
  textDayFontSize: number;
  textDayFontWeight: "400" | "600" | "light" | "normal" | "bold" | "100" | "200" | "300" | "500" | "700" | "800" | "900";
  textMonthFontSize: number;
  textMonthFontWeight: "400" | "600" | "light" | "normal" | "bold" | "100" | "200" | "300" | "500" | "700" | "800" | "900";
  textDayHeaderFontSize: number;
  "stylesheet.calendar.header": {
    header: {
      flexDirection: "row";
      justifyContent: "space-between";
      paddingLeft: number;
      paddingRight: number;
      marginTop: number;
      alignItems: "center";
    };
  };
}
