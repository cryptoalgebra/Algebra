pragma solidity 0.7.6;
pragma abicoder v2;

import './NFTSVG.sol';

library SVGStrings {
    bytes16 private constant _HEX_SYMBOLS = '0123456789abcdef';
    uint8 private constant _ADDRESS_LENGTH = 20;
    string private constant mainSvgPart =
        '<svg version="1.2" baseProfile="tiny-ps" xmlns="http://www.w3.org/2000/svg" width="600" height="600" style="background: radial-gradient(50% 50% at 50% 50%, #F0F0F0 0%, #F1F1F1 100%);"> <svg x="140" y="410" width="323" height="105" viewBox="0 0 323 105" fill="none"> <ellipse cx="161" cy="27" rx="159" ry="24" fill="url(#a)"/> <g filter="url(#c)"> <path d="M320 78.7V32C291.26 63.6 15.8 59.2 3 32V78.7521C65.19 112 274.1 107.3 320 79Z" fill="black" fill-opacity="0.2"></path> </g> <path d="M321 74.7521V28C292.078 59 15 55 2 28V74C64.6 108 274.8 103.3 321 74.7Z" fill="url(#b)"></path> <g filter="url(#e)"> <ellipse cx="161.5" cy="26.5" rx="159.5" ry="24.5" stroke="#F7F7F7" stroke-width="2"/> </g> <defs> <filter id="c" x="0" y="29" width="323" height="76" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"> <feFlood flood-opacity="0" result="BIF"/> <feBlend mode="normal" in="SourceGraphic" in2="BIF" result="shape"/> <feGaussianBlur stdDeviation="1.5" result="d"/> </filter> <filter id="e" x="0" y="0" width="323" height="53" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"> <feFlood flood-opacity="0" result="BIF"/> <feBlend mode="normal" in="SourceGraphic" in2="BIF" result="shape"/> <feGaussianBlur stdDeviation="0.5" result="d"/> </filter> <linearGradient id="a" x1="313" y1="24" x2="15" y2="23" gradientUnits="userSpaceOnUse"> <stop stop-color="#E9E9E9"/> <stop offset="1" stop-color="#EDEDED"/> </linearGradient> <linearGradient id="b" x1="321" y1="59" x2="4" y2="59" gradientUnits="userSpaceOnUse"> <stop stop-color="#C9C9C9"/> <stop offset="1" stop-color="#ECECEC"/> </linearGradient> </defs> </svg> <svg width="93" height="18" x="20" y="570" viewBox="0 0 93 18" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M10.0381 0.8L10.4999 0L10.9618 0.8L19.9974 16.45L20.4592 17.25H19.5355H1.46441H0.540649L1.00253 16.45L10.0381 0.8ZM10.0999 2.29282L2.27542 15.8453L10.0999 10.7824V2.29282ZM1.94577 16.4163L1.92629 16.45H1.96761L1.94577 16.4163ZM10.4999 11.4764L18.1864 16.45H2.81348L10.4999 11.4764ZM18.7245 15.8453L10.8999 10.7824V2.29282L18.7245 15.8453ZM19.0323 16.45L19.0541 16.4163L19.0736 16.45H19.0323ZM32.4159 3.346C31.8559 3.346 31.2726 3.472 30.6659 3.724L30.7079 3.864C31.0906 3.724 31.4499 3.654 31.7859 3.654C32.5326 3.654 33.1579 4.01333 33.6619 4.732L30.1899 13.048C30.0499 13.3187 29.8726 13.524 29.6579 13.664C29.4433 13.7947 29.2239 13.86 28.9999 13.86H28.8739V14H31.6879V13.86H31.5759C31.3706 13.86 31.2166 13.7993 31.1139 13.678C31.0206 13.5473 30.9739 13.426 30.9739 13.314C30.9739 13.202 30.9973 13.09 31.0439 12.978L32.0099 10.486H35.8459L36.3919 12.082C36.9519 13.7433 37.6333 14.98 38.4359 15.792C38.8093 16.184 39.2106 16.4873 39.6399 16.702C40.0693 16.926 40.4986 17.038 40.9279 17.038C41.3573 17.038 41.7959 16.9633 42.2439 16.814L42.2299 16.674C42.0433 16.7113 41.8286 16.73 41.5859 16.73C41.3526 16.73 41.0539 16.6647 40.6899 16.534C40.3259 16.4033 39.9759 16.1747 39.6399 15.848C39.3039 15.5307 38.9306 15.05 38.5199 14.406C38.1186 13.7713 37.7219 12.9127 37.3299 11.83L35.6219 6.986C35.2766 6.006 34.9919 5.32933 34.7679 4.956C34.4319 4.41467 34.1286 4.05067 33.8579 3.864C33.3633 3.51867 32.8826 3.346 32.4159 3.346ZM35.7059 10.066H32.1639L34.0119 5.334C34.1893 5.68867 34.3853 6.17867 34.5999 6.804L35.7059 10.066ZM40.6047 13.608C40.4367 13.776 40.2314 13.86 39.9887 13.86H39.8067V14H45.6167L46.4287 11.732H46.2887C46.0461 12.3387 45.7427 12.796 45.3787 13.104C45.0147 13.412 44.4874 13.566 43.7967 13.566H41.7947V5.222C41.7947 5.06333 41.8367 4.914 41.9207 4.774C42.0981 4.48467 42.3547 4.34 42.6907 4.34H42.8727V4.2H39.8067V4.34H39.9887C40.2314 4.34 40.4367 4.42867 40.6047 4.606C40.7821 4.774 40.8754 4.97933 40.8847 5.222V12.978C40.8754 13.2207 40.7821 13.4307 40.6047 13.608ZM48.7806 12.782C49.714 13.7153 50.9273 14.1867 52.4206 14.196C53.0833 14.196 53.6946 14.1027 54.2546 13.916C54.824 13.72 55.2766 13.496 55.6126 13.244C55.9486 12.992 56.238 12.7073 56.4806 12.39V10.08C56.4713 9.87467 56.5273 9.72067 56.6486 9.618C56.77 9.506 56.9473 9.45 57.1806 9.45H57.3906V9.31H54.6466V9.45H54.8706C55.0946 9.45 55.2673 9.506 55.3886 9.618C55.5193 9.72067 55.5846 9.87467 55.5846 10.08V12.558C55.174 12.9407 54.6933 13.2393 54.1426 13.454C53.6013 13.6687 53.0273 13.776 52.4206 13.776C51.2353 13.7667 50.274 13.3373 49.5366 12.488C48.8086 11.6293 48.4446 10.5 48.4446 9.1C48.4446 7.7 48.8086 6.57067 49.5366 5.712C50.274 4.85333 51.2353 4.424 52.4206 4.424C53.3446 4.424 54.1146 4.64333 54.7306 5.082C55.356 5.51133 55.7713 6.12733 55.9766 6.93H56.1026L55.8226 4.956C54.8426 4.32133 53.7086 4.004 52.4206 4.004C50.9273 4.004 49.714 4.47533 48.7806 5.418C47.8566 6.35133 47.3946 7.57867 47.3946 9.1C47.3946 10.6213 47.8566 11.8487 48.7806 12.782ZM59.0071 13.608C58.8391 13.776 58.6338 13.86 58.3911 13.86H58.2091V14H64.0191L64.8311 11.732H64.6911C64.4484 12.3387 64.1451 12.796 63.7811 13.104C63.4171 13.412 62.8898 13.566 62.1991 13.566H60.1971V9.38H62.5771C62.7638 9.38933 62.9178 9.45933 63.0391 9.59C63.1698 9.72067 63.2351 9.87933 63.2351 10.066V10.276H63.3751V8.064H63.2351V8.26C63.2351 8.456 63.1698 8.61933 63.0391 8.75C62.9084 8.88067 62.7498 8.95067 62.5631 8.96H60.1971V4.634H63.0531C63.2677 4.64333 63.4497 4.72733 63.5991 4.886C63.7578 5.04467 63.8371 5.236 63.8371 5.46V5.712H63.9771V3.948C63.8371 4.004 63.5944 4.06 63.2491 4.116C62.9131 4.172 62.6004 4.2 62.3111 4.2H58.2091L58.2231 4.34H58.3911C58.6338 4.34 58.8438 4.41933 59.0211 4.578C59.1984 4.72733 59.2871 4.914 59.2871 5.138V12.978C59.2778 13.2207 59.1844 13.4307 59.0071 13.608ZM66.1524 14H69.5684C70.5951 14 71.3931 13.762 71.9624 13.286C72.5411 12.81 72.8304 12.1987 72.8304 11.452C72.8304 10.696 72.6158 10.0707 72.1864 9.576C71.7571 9.08133 71.1738 8.778 70.4364 8.666C70.8658 8.54467 71.2298 8.302 71.5284 7.938C71.8271 7.56467 71.9764 7.098 71.9764 6.538C71.9764 5.82867 71.7104 5.264 71.1784 4.844C70.6464 4.41467 69.8998 4.2 68.9384 4.2H66.1524L66.1664 4.34H66.3344C66.5771 4.34 66.7824 4.424 66.9504 4.592C67.1278 4.76 67.2211 4.96533 67.2304 5.208V12.992C67.2211 13.2347 67.1278 13.44 66.9504 13.608C66.7824 13.776 66.5771 13.86 66.3344 13.86H66.1664L66.1524 14ZM69.5124 13.482H68.1404V4.648H68.8824C69.5451 4.648 70.0491 4.82067 70.3944 5.166C70.7491 5.51133 70.9264 6.00133 70.9264 6.636C70.9264 6.888 70.8984 7.11667 70.8424 7.322C70.5904 8.23667 69.8484 8.694 68.6164 8.694V8.82H68.6304C69.7131 8.82 70.5251 9.044 71.0664 9.492C71.2718 9.66933 71.4398 9.912 71.5704 10.22C71.7104 10.5187 71.7804 10.8687 71.7804 11.27C71.7804 11.9793 71.5844 12.5253 71.1924 12.908C70.8004 13.2907 70.2498 13.482 69.5404 13.482H69.5124ZM76.2068 4.634H77.1029C77.4389 4.634 77.7188 4.63867 77.9428 4.648C78.4655 4.676 78.8809 4.88133 79.1889 5.264C79.4968 5.64667 79.6602 6.15067 79.6788 6.776V7.098C79.6788 7.25667 79.6508 7.42933 79.5948 7.616C79.2962 8.55867 78.5682 9.044 77.4109 9.072C77.2335 9.08133 77.0842 9.086 76.9629 9.086C76.8415 9.086 76.7435 9.08133 76.6688 9.072V9.212C76.9675 9.212 77.2662 9.37067 77.5648 9.688C77.6675 9.8 77.7655 9.91667 77.8588 10.038C77.9522 10.15 78.2835 10.6167 78.8529 11.438C79.4222 12.2593 79.7675 12.7447 79.8888 12.894C80.0195 13.034 80.1688 13.1833 80.3368 13.342C80.5142 13.4913 80.7755 13.6407 81.1208 13.79C81.4662 13.93 81.8395 14 82.2409 14H82.3036H83.0108H85.1176V13.86H84.9916C84.7956 13.86 84.6463 13.7993 84.5436 13.678C84.4503 13.5473 84.4036 13.4307 84.4036 13.328C84.4036 13.216 84.4223 13.104 84.4596 12.992L85.3976 10.598H89.1776L90.0736 12.978C90.111 13.09 90.1296 13.202 90.1296 13.314C90.1296 13.426 90.0783 13.5473 89.9756 13.678C89.8823 13.7993 89.7376 13.86 89.5416 13.86H89.4156V14H92.5656V13.86H92.4536C92.211 13.86 91.9776 13.7853 91.7536 13.636C91.5296 13.4867 91.3523 13.2673 91.2216 12.978L87.4696 4.004H87.3436C87.3436 4.20933 87.171 4.69 86.8256 5.446L83.6616 12.978C83.5216 13.2673 83.3396 13.4867 83.1156 13.636C82.97 13.7331 82.8225 13.7986 82.6729 13.8326C82.4889 13.802 82.3122 13.7458 82.1429 13.664C82.0215 13.608 81.9002 13.5333 81.7788 13.44C81.6575 13.3467 81.5455 13.2533 81.4428 13.16C81.3402 13.0573 81.1675 12.8753 80.9249 12.614C80.6822 12.3433 80.1595 11.634 79.3568 10.486C79.2075 10.2807 79.0349 10.0847 78.8389 9.898C78.6522 9.702 78.4888 9.57133 78.3488 9.506C79.0115 9.506 79.5715 9.23533 80.0288 8.694C80.4955 8.14333 80.7289 7.49467 80.7289 6.748C80.7289 5.992 80.4862 5.38067 80.0008 4.914C79.5155 4.438 78.8482 4.2 77.9988 4.2H74.2188V4.34H74.4008C74.6435 4.34 74.8488 4.42867 75.0168 4.606C75.1942 4.774 75.2875 4.97933 75.2969 5.222V12.992C75.2875 13.2347 75.1942 13.44 75.0168 13.608C74.8488 13.776 74.6435 13.86 74.4008 13.86H74.2188V14H77.2849L77.2709 13.86H77.1029C76.8508 13.86 76.6362 13.776 76.4588 13.608C76.2908 13.4307 76.2068 13.2207 76.2068 12.978V4.634ZM89.0096 10.178H85.5656L87.3296 5.684L89.0096 10.178Z" fill="black"></path> </svg> <defs> <filter id="shadow" x="-9.39197" y="-9.74997" width="211.784" height="220" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"> <feFlood flood-opacity="0" result="BackgroundImageFix"/> <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/> <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/> <feOffset dx="-10" dy="-10"/> <feGaussianBlur stdDeviation="11.5"/> <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/> <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/> <feBlend mode="normal" in2="shape"/> </filter> </defs> <svg x="140" y="475" width="323" height="105" fill="#747474"> <path id="P" pathLength="2" d="M0 12H323" stroke="transparent"></path> <text> <textPath href="#P" startOffset="1" text-anchor="middle" dominant-baseline="middle" fill="#747474" font-size="14px">';

    function toString(int256 value) internal pure returns (string memory) {
        uint256 uvalue;
        bool isNegative;
        if (value == 0) {
            return '0';
        }
        if (value < 0) {
            isNegative = true;
            uvalue = uint256(-value);
        } else {
            uvalue = uint256(value);
        }

        uint256 temp = uvalue;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (uvalue != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(uvalue % 10)));
            uvalue /= 10;
        }

        if (isNegative) {
            return string(abi.encodePacked('-', buffer));
        }
        return string(buffer);
    }

    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return '000000';
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length);
        for (uint256 i = 2 * length; i > 0; --i) {
            buffer[i - 1] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, 'myStrings: hex length insufficient');
        return string(buffer);
    }

    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }

    function getColorString(
        bytes32 idHash,
        uint256 startIndex,
        uint256 endIndex
    ) public pure returns (string memory) {
        uint256 counter;
        uint256 color;

        for (uint256 i = startIndex; i < endIndex && idHash[i] != 0; i++) {
            color += uint8(idHash[i]) * 256**counter;
            counter++;
        }
        return toHexString(color);
    }

    function getMainShapeString(NFTSVG.MainShapeParams memory _params) public pure returns (string memory svg) {
        uint256 id = _params.id;
        string memory sideShapes = _params.sideShapes;
        NFTSVG.Point memory msc_mainShape = _params.msc_mainShape;
        NFTSVG.Shapes memory mscs_mainShape = _params.mscs_mainShape;
        string memory ms_mainShape = _params.ms_mainShape;
        string memory mainColor = _params.mainColor;
        svg = string(
            abi.encodePacked(
                mainSvgPart,
                toString(int256(id)),
                '</textPath> </text> </svg> <svg x="',
                toString(int256(msc_mainShape.x)),
                'px" y="',
                toString(int256(msc_mainShape.y)),
                'px" fill="#',
                string(mainColor),
                '" filter="url(#shadow)"> <animate attributeName="y" dur="5s" repeatCount="indefinite" values="',
                toString(int256(msc_mainShape.y)),
                ';',
                toString(int256(msc_mainShape.y + 10)),
                ';',
                toString(int256(msc_mainShape.y)),
                '"></animate> <path d="',
                ms_mainShape,
                '"></path> </svg>',
                sideShapes
            )
        );
        svg = string(
            abi.encodePacked(
                svg,
                '<svg x="',
                toString(int256(int128(mscs_mainShape.x))),
                '" y="430" fill-opacity="0.2"> <defs> <filter id="filter0_f_54_15" x="0" y="0" width="',
                toString(int256(int128(mscs_mainShape.w))),
                '" height="10" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"> <feFlood flood-opacity="0" result="BackgroundImageFix"/> <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/> <feGaussianBlur stdDeviation="1.5" result="effect1_foregroundBlur_54_15"/> </filter> </defs> <animate attributeName="fill-opacity" dur="5s" repeatCount="indefinite" values="0.1;0.5;0.1"></animate> <g filter="url(#filter0_f_54_15)"> <path d="',
                mscs_mainShape.p,
                '" fill="#A0A0A0"></path> </g> </svg> </svg>'
            )
        );
    }

    function getSideShapesString(
        uint8[4] memory sides,
        bytes32 idHash,
        NFTSVG.Point[3][3][11] memory ssc,
        NFTSVG.Shapes[10] memory sShapes,
        NFTSVG.Point[2][4] memory sidesAnimations
    ) public pure returns (string memory) {
        bytes memory sideShapes;

        for (uint256 i = 0; i < 4; i++) {
            uint256 k = sides[i] / 3;
            uint256 l = sides[i] % 3;
            NFTSVG.Shapes memory sShapes_sides = sShapes[sides[i]];
            string memory color = getColorString(idHash, 3 * (i + 1), 3 * (i + 2));
            int256 xw = int256(ssc[sides[i]][k][l].x - int128(sShapes_sides.w) / 2);
            int256 yx = int256(ssc[sides[i]][k][l].y - int128(sShapes_sides.x) / 2);
            NFTSVG.Point memory animation0 = sidesAnimations[i][0];
            NFTSVG.Point memory animation1 = sidesAnimations[i][1];

            sideShapes = abi.encodePacked(
                sideShapes,
                '<svg x="',
                toString(xw),
                '" y="',
                toString(yx),
                '" fill="#',
                string(abi.encodePacked(color)),
                '" ><animate attributeName="x" dur="30s" repeatCount="indefinite" values="',
                toString(xw),
                ';',
                toString(int256(yx + animation0.x)),
                ';',
                toString(int256(xw + animation1.x)),
                ';',
                toString(xw),
                '"></animate><animate attributeName="y" dur="30s" repeatCount="indefinite" values="',
                toString(yx),
                ';',
                toString(int256(yx + animation0.y)),
                ';',
                toString(int256(yx + animation1.y)),
                ';',
                toString(yx),
                '"></animate><path d="'
            );
            sideShapes = abi.encodePacked(sideShapes, sShapes_sides.p, '"></path></svg>');
        }

        return string(sideShapes);
    }
}
