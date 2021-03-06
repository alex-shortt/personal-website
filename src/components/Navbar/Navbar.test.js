import React from "react"
import renderer from "react-test-renderer"
import "jest-styled-components"

import Navbar from "./index"

it("renders correctly", () => {
  const tree = renderer.create(<Navbar />).toJSON()

  expect(tree).toMatchSnapshot()
})
