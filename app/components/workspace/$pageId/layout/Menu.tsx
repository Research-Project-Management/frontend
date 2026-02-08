import React from "react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from "~/components/ui/menubar";

export default function Menu() {
  const menuItems = ["File", "Edit", "View", "Insert", "Format", "Tools"];

  return (
    <Menubar className="border-0 shadow-none">
      {menuItems.map((item) => (
        <MenubarMenu key={item}>
          <MenubarTrigger>{item}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Item 1</MenubarItem>
            <MenubarItem>Item 2</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
