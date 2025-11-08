
import Hero from "../components/hero/hero";
import SplitText from "../components/text/split-text";
import Folder from "../components/folder/folder";

export default function Home() {
  return (
    <main>
      <Hero videoSrc="/hero-video.mp4" overlayOpacity={10}>
        <SplitText
          text="Chào mừng đến với Smart Travel"
          tag="h1"
          className="text-4xl md:text-6xl font-bold"
          splitType="words, chars"
          delay={40}
        />

        <SplitText
          text="Tạo lịch trình du lịch của riêng bạn chỉ với một vài cú nhấp chuột."
          tag="p"
          className="mt-4 text-lg md:text-xl"
          splitType="words"
          delay={30}
        />
      </Hero>
      <Folder />

    </main>
  );
}
