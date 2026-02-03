document.addEventListener("DOMContentLoaded", () => {
  const collapsibleHeaders = document.querySelectorAll(".collapsible-header");

  collapsibleHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector(".toggle-icon");

      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        if (icon) icon.textContent = "+";
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        if (icon) icon.textContent = "-";
      }
    });
  });
});
