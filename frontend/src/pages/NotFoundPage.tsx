// 404 Not Found page component with random message and animated elements

import { motion } from "framer-motion"
import { IoIosWarning } from "react-icons/io"
import { useEffect } from "react"
import { setThemeColor } from "@utils/setThemeColor"
import { setPageName } from "@utils/setPageName"

import HomeroChino from "@assets/homerochino.webp"

export const NotFoundPage = () => {
  // Set page theme color on component mount
  useEffect(() => {
    setThemeColor("#f5f6f7")
    setPageName("Not Found")
  }, [])

  // Generate random number for conditional content display
  const randomNum = Math.floor(Math.random() * (10 - 1 + 1)) + 1
  const msg =
    randomNum === 1
      ? "I don't know what are you doing on this route, but, take this Homero Chino!"
      : "The page you are trying to access does not exist."

  // Animation variants for container element
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  // Animation variants for child elements
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gray-100 p-8"
    >
      {/* Conditionally render Homero Chino image or warning icon based on random number */}
      {randomNum === 1 ? (
        <motion.img src={HomeroChino} className="h-40" variants={itemVariants} />
      ) : (
        <motion.div variants={itemVariants}>
          <IoIosWarning className="text-5xl text-yellow-500" />
        </motion.div>
      )}

      <motion.h1 className="text-center font-heading text-2xl" variants={itemVariants}>
        <b>404</b>: This page not exists!
      </motion.h1>

      <motion.p className="text-center font-body" variants={itemVariants}>
        {msg}
      </motion.p>
    </motion.div>
  )
}
