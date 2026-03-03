import imgDiscordNew from "@/assets/images/discord.png";
import imgLinkedIn from "@/assets/images/linkedin.png";
import imgFacebook from "@/assets/images/facebook.png";
import imgTikTok from "@/assets/images/tiktok.png";
import imgEmail from "@/assets/images/email.png";
import imgInstagram from "@/assets/images/instagram.png";
import imgExpandArrow from "@/assets/images/email_send.png";
import imgAussLogo1 from "@/assets/images/AUSS_logo.png";
import imgImage6 from "figma:asset/e371b62704623c413d9bdee0dd71bab50a7574a7.png";
import imgImage3 from "figma:asset/daceedfe44d94cec0d3dc3c509c9aa0a6b4c49b7.png";
import imgImage4 from "figma:asset/3aa05745098169409565aad61490bff33dc31c32.png";
import imgImage5 from "figma:asset/fb22c559e5e5a86ec1f267ba37498de095a30684.png";
import imgImage7 from "figma:asset/4667da3ff19dfa975facf584b01a185a16c1ef78.png";
import imgImage8 from "figma:asset/b23749e54aaed69f499445b9a07c2262982b5220.png";
import imgImage9 from "figma:asset/b94637808b69f44808c278169e578c966c85876d.png";
import imgImage10 from "figma:asset/a48dd0126c2172afa4cf97371aa1b407a8eef45c.png";

function Socials() {
  return (
    <div className="absolute h-[53px] left-[502px] top-[83px] w-[436px]" data-name="Socials">
      <div className="absolute h-[53px] left-[377px] top-0 w-[59px]" data-name="Discord New">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgDiscordNew} />
      </div>
      <div className="absolute h-[53px] left-[75px] top-0 w-[59px]" data-name="LinkedIn">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgLinkedIn} />
      </div>
      <div className="absolute h-[53px] left-[150px] top-0 w-[60px]" data-name="Facebook">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgFacebook} />
      </div>
      <div className="absolute h-[53px] left-[301px] top-0 w-[60px]" data-name="TikTok">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgTikTok} />
      </div>
      <div className="absolute h-[53px] left-0 top-0 w-[59px]" data-name="Email">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgEmail} />
      </div>
      <div className="absolute h-[53px] left-[226px] top-0 w-[59px]" data-name="Instagram">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgInstagram} />
      </div>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[34px] top-[27px]">
      <p className="-translate-x-1/2 absolute left-[78.5px] text-[15px] top-[28px]">Membership</p>
      <p className="-translate-x-1/2 absolute left-[295.5px] text-[15px] top-[27px]">Sponsorship</p>
      <p className="-translate-x-1/2 absolute left-[187px] text-[14px] top-[28px]">Media/Photos</p>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[105px] text-[15px] top-[5px]">
      <p className="-translate-x-1/2 absolute left-[126px] top-[5px]">Home</p>
      <p className="-translate-x-1/2 absolute left-[186.5px] top-[5px]">About</p>
      <p className="-translate-x-1/2 absolute left-[247.5px] top-[5px]">Social</p>
    </div>
  );
}

function Items() {
  return (
    <div className="absolute font-['Inter:Regular',sans-serif] font-normal h-[54px] leading-[normal] left-[541px] not-italic text-center text-white top-[-13px] w-[374px]" data-name="Items">
      <Group1 />
      <Group />
    </div>
  );
}

function Footer() {
  return (
    <div className="absolute h-[187px] left-0 top-[1591px] w-[1440px]" data-name="Footer">
      <div className="absolute bg-[#141414] h-[216px] left-0 top-[-29px] w-[1440px]" data-name="Footer" />
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[720px] not-italic text-[14px] text-center text-white top-[157px]">@ 2026 Auckland University Strength Society</p>
      <Socials />
      <Items />
      <div className="absolute h-0 left-[502px] top-[62px] w-[436px]" data-name="split">
        <div className="absolute inset-[-2px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 436 2">
            <line id="split" stroke="var(--stroke-0, white)" strokeWidth="2" x2="436" y1="1" y2="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Links() {
  return (
    <div className="absolute h-[34px] left-[225px] top-[16px] w-[127px]" data-name="Links">
      <div className="absolute h-[20px] left-[90px] top-[10px] w-[23px]" data-name="Expand Arrow">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgExpandArrow} />
      </div>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[53px] text-[27px] text-center text-white top-0 w-[106px] whitespace-pre-wrap">Links</p>
    </div>
  );
}

function ItemGroup() {
  return (
    <div className="absolute h-[66px] left-[625px] overflow-clip top-0 w-[471px]" data-name="Item Group">
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[66px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">Home</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[405px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">Socials</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[172px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">About</p>
      <Links />
    </div>
  );
}

function Container() {
  return (
    <div className="absolute h-[66px] left-[95px] overflow-clip top-[7px] w-[1240px]" data-name="Container">
      <ItemGroup />
      <div className="absolute left-[137px] rounded-[381.5px] size-[62px] top-[2px]" data-name="auss logo 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[381.5px] size-full" src={imgAussLogo1} />
      </div>
    </div>
  );
}

function PresidentExects1() {
  return (
    <div className="absolute content-stretch flex gap-[36px] items-center left-0 top-0" data-name="President exects">
      <div className="h-[187px] relative rounded-[93.5px] shrink-0 w-[191px]" data-name="image 6">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[93.5px] size-full" src={imgImage6} />
      </div>
      <div className="h-[187px] relative rounded-[93.5px] shrink-0 w-[188px]" data-name="image 3">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[93.5px]">
          <img alt="" className="absolute h-full left-[-0.06%] max-w-none top-0 w-[100.11%]" src={imgImage3} />
        </div>
      </div>
      <div className="h-[189px] relative rounded-[94.5px] shrink-0 w-[191px]" data-name="image 4">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[94.5px] size-full" src={imgImage4} />
      </div>
      <div className="h-[189px] relative rounded-[94.5px] shrink-0 w-[191px]" data-name="image 5">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[94.5px]">
          <img alt="" className="absolute h-[104.09%] left-0 max-w-none top-[-0.2%] w-full" src={imgImage5} />
        </div>
      </div>
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents leading-[normal] left-[34px] text-[20px] text-white top-[192px] whitespace-pre-wrap">
      <p className="absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[34px] top-[212px] w-[124px]">Co-President</p>
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[62px] top-[192px] w-[68px]">Francis</p>
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents leading-[normal] left-[259px] text-[20px] text-white top-[192px] whitespace-pre-wrap">
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[297px] top-[192px] w-[47px]">Evan</p>
      <p className="absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[259px] top-[212px] w-[124px]">Co-President</p>
    </div>
  );
}

function Group4() {
  return (
    <div className="absolute contents leading-[normal] left-[478px] text-[20px] text-white top-[192px] whitespace-pre-wrap">
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[516px] top-[192px] w-[61px]">Richky</p>
      <p className="absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[478px] top-[212px] w-[137px]">Vice-President</p>
    </div>
  );
}

function Group5() {
  return (
    <div className="absolute contents leading-[normal] left-[705px] text-[20px] text-white top-[192px] whitespace-pre-wrap">
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[734px] top-[192px] w-[80px]">Brendan</p>
      <p className="absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[705px] top-[212px] w-[137px]">Senior Advisor</p>
    </div>
  );
}

function PresidentExects() {
  return (
    <div className="absolute h-[237px] left-0 top-[144px] w-[869px]" data-name="President exects">
      <PresidentExects1 />
      <Group2 />
      <Group3 />
      <Group4 />
      <Group5 />
    </div>
  );
}

function Group6() {
  return (
    <div className="absolute contents leading-[normal] left-[55px] text-[20px] text-white top-[664px] whitespace-pre-wrap">
      <p className="absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[55px] top-[684px] w-[89px]">Secretary</p>
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[60px] top-[664px] w-[79px]">Johnson</p>
    </div>
  );
}

function Group7() {
  return (
    <div className="absolute contents leading-[normal] left-[276px] text-[20px] text-center text-white top-[669px] whitespace-pre-wrap">
      <p className="-translate-x-1/2 absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[320.5px] top-[689px] w-[89px]">Treasurer</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[320.5px] top-[669px] w-[79px]">Anton</p>
    </div>
  );
}

function Group8() {
  return (
    <div className="absolute contents leading-[normal] left-[453px] text-[20px] text-center text-white top-[669px] whitespace-pre-wrap">
      <p className="-translate-x-1/2 absolute font-['Outfit:Light',sans-serif] font-light h-[25px] left-[546.5px] top-[689px] w-[187px]">Public Relations</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Medium',sans-serif] font-medium h-[28px] left-[546.5px] top-[669px] w-[79px]">Raphael</p>
    </div>
  );
}

function AboutUsSection() {
  return (
    <div className="absolute h-[996px] left-[285px] top-[152px] w-[869px]" data-name="About us section">
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[77px] leading-[normal] left-0 text-[55px] text-white top-0 w-[525px] whitespace-pre-wrap">Meet the executives.</p>
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[31px] leading-[normal] left-0 text-[25px] text-white top-[95px] w-[121px] whitespace-pre-wrap">Presidents</p>
      <PresidentExects />
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[31px] leading-[normal] left-0 text-[25px] text-white top-[425px] w-[121px] whitespace-pre-wrap">Admin</p>
      <div className="absolute h-[187px] left-[121px] top-[760px] w-[191px]" data-name="image 2">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage6} />
      </div>
      <div className="absolute h-[187px] left-[4px] rounded-[93.5px] top-[477px] w-[191px]" data-name="image 6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[93.5px]">
          <img alt="" className="absolute h-[106.05%] left-0 max-w-none top-[-0.08%] w-full" src={imgImage7} />
        </div>
      </div>
      <div className="absolute h-[187px] left-[225px] rounded-[93.5px] top-[477px] w-[191px]" data-name="image 7">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[93.5px]">
          <img alt="" className="absolute h-[102.7%] left-0 max-w-none top-[-0.01%] w-full" src={imgImage8} />
        </div>
      </div>
      <div className="absolute h-[187px] left-[452px] rounded-[93.5px] top-[477px] w-[190px]" data-name="image 8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[93.5px]">
          <img alt="" className="absolute h-[102.25%] left-0 max-w-none top-[-0.05%] w-full" src={imgImage9} />
        </div>
      </div>
      <div className="absolute h-[187px] left-[678px] rounded-[93.5px] top-[477px] w-[191px]" data-name="image 9">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[93.5px] size-full" src={imgImage10} />
      </div>
      <Group6 />
      <Group7 />
      <Group8 />
    </div>
  );
}

export default function MeetTheExec() {
  return (
    <div className="bg-black relative size-full" data-name="Meet the Exec">
      <Footer />
      <div className="absolute bg-black h-[85px] left-0 top-0 w-[1440px]" data-name="Navbar - Jayden">
        <div className="overflow-clip relative rounded-[inherit] size-full">
          <Container />
        </div>
        <div aria-hidden="true" className="absolute border-[rgba(255,255,255,0.42)] border-b-[1.5px] border-solid inset-[0_0_-1.5px_0] pointer-events-none" />
      </div>
      <AboutUsSection />
    </div>
  );
}