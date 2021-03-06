import { createGlobalStyle } from "styled-components/macro"
import "typeface-roboto"
import "normalize.css"

import "./fontawesome"

export default createGlobalStyle`
  html, body, #root {
    width: 100%;
    height: 100%;
    background: white;
    overscroll-behavior: none;
    position: relative;
  }

  body {
    font-family: Avenir, Lato, Roboto, sans-serif;
    overflow: auto;
    overflow-x: hidden;
  }
 
`
