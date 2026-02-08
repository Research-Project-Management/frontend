import React from "react";
import HomeSection from "./HomeSection";
import ChatAi from "./Sections/ChatAi";
import Recent from "./Sections/Recent";
import ShortCut from "./Sections/ShortCut";
import Activity from "./Sections/Activity";
import Stickies from "./Sections/Stickies";
import { Pen } from "lucide-react";
import Header from "../layout/Header";

export default function HomeDashboard() {
  return (
    <div className=" h-full flex flex-col flex-1 ">
      <Header title="Home" Icon={Pen} />
      <div className="flex flex-col p-4 gap-10 w-5xl items-center justify-between mx-auto">
        <ChatAi />
        <ShortCut />
        <Stickies />
        <Recent />
        <Activity />
      </div>
    </div>
  );
}
