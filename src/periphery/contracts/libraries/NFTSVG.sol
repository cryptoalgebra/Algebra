pragma solidity =0.7.6;
pragma abicoder v2;

import './SVGStrings.sol';

library NFTSVG {
    struct Point {
        int128 x;
        int128 y;
    }

    struct Shapes {
        string p;
        uint128 w;
        uint128 x;
    }

    struct MainShapeParams {
        uint256 id;
        string sideShapes;
        Point msc_mainShape;
        Shapes mscs_mainShape;
        string ms_mainShape;
        string mainColor;
    }

    function getSideShapes(bytes32 idHash) private pure returns (uint8[4] memory) {
        uint8 counter = 0;
        uint8 step = 1;
        uint8[4] memory indecies;
        uint256 i;
        // TODO Check when indecies length is not 4, step = max, went through full hash
        while (i != 4) {
            if (counter != idHash.length - 2) {
                uint8 digit = uint8(getNumberFromHash(idHash, counter, counter + step) % 9);

                if (!inShapesYet(indecies, digit)) {
                    indecies[i] = digit;
                    i++;
                }

                counter++;
            } else {
                counter = 0;
                step++;
            }
        }
        return indecies;
    }

    function inShapesYet(uint8[4] memory _sideShapes, uint8 _digit) private pure returns (bool) {
        for (uint8 i; i < _sideShapes.length; i++) {
            if (_sideShapes[i] == _digit) return true;
        }
        return false;
    }

    function countMatrix(
        int128 w,
        int128 h,
        uint256 mainShape,
        Point[11] memory msc
    ) private pure returns (Point[3][3] memory) {
        int128 wS = w / 4;
        int128 hS = h / 4;

        Point[3][3] memory arr;

        for (uint256 i = 0; i < 3; i++) {
            int128 k = hS * (int128(uint128(i)) + 1);

            for (uint256 j = 0; j < 3; j++) {
                arr[i][j] = Point(msc[mainShape].x + wS * (int128(uint128(j)) + 1), msc[mainShape].y + k);
            }
        }
        return arr;
    }

    function getNumberFromHash(
        bytes32 hash,
        uint256 startIndex,
        uint256 endIndex
    ) private pure returns (uint256) {
        uint256 number;
        for (uint256 i = startIndex; i < endIndex && i < 32; i++) {
            number = number + uint256(uint8(hash[i])) * (2**(8 * (hash.length - (i + 1))));
        }
        return number;
    }

    function generateSVG(uint256 tokenId) internal pure returns (string memory) {
        bytes32 idHash = keccak256(abi.encodePacked(tokenId));
        MainShapeParams memory params;
        params.id = tokenId;

        params.mainColor = SVGStrings.getColorString(idHash, 0, 3);

        uint256 mainShape = uint256(idHash) % 11;
        uint8[4] memory sides = getSideShapes(idHash);
        Point[2][4] memory animationCoords = [
            [Point(-20, -20), Point(20, 20)],
            [Point(20, -20), Point(-20, 20)],
            [Point(20, 20), Point(-20, -20)],
            [Point(-20, 20), Point(20, -20)]
        ];
        Point[2][4] memory sidesAnimations;
        for (uint256 i; i < 4; i++) {
            sidesAnimations[i] = animationCoords[sides[i] % 4];
        }
        string[11] memory ms = [
            'M101.5 175L0.6 0.25L202.4 0.25L101.5 175Z',
            'M175 87.5C175 135.8 135.8 175 87.5 175C39.2 175 0 135.8 0 87.5C0 39.1751 39.2 0 87.5 0C135.8 0 175 39.2 175 87.5Z',
            'M0 0H175V175H0V0Z',
            'M95.4594 0L190.919 95.4594L95.4594 190.919L0 95.4594L95.4594 0Z',
            'M90 62L28.5 0.5L0 29L62 90.5L0 152.5L28 181L90 119L152 181L180.5 152.5L118.5 90.5L180.5 28.5L152 0L90 62Z',
            'M195 97.5C195 151.348 151.348 195 97.5 195C43.6522 195 0 151.348 0 97.5C0 43.6522 43.6522 0 97.5 0C151.348 0 195 43.6522 195 97.5ZM48.8211 97.5C48.8211 124.385 70.6154 146.179 97.5 146.179C124.385 146.179 146.179 124.385 146.179 97.5C146.179 70.6154 124.385 48.8211 97.5 48.8211C70.6154 48.8211 48.8211 70.6154 48.8211 97.5Z',
            'M71.3608 115.893C54.9536 119.528 37.1114 116.12 22.7769 105.038C-2.84556 85.2291 -7.5582 48.3994 12.251 22.7769C32.0601 -2.84556 68.8897 -7.5582 94.5122 12.251C108.847 23.3332 116.637 39.7426 117.25 56.5364C133.657 52.9013 151.499 56.3086 165.834 67.3908C191.456 87.1999 196.169 124.03 176.36 149.652C156.551 175.275 119.721 179.987 94.0985 160.178C79.764 149.096 71.9739 132.686 71.3608 115.893ZM40.7369 81.8076C27.9443 71.9174 25.5914 53.5295 35.4816 40.7369C45.3717 27.9443 63.7597 25.5914 76.5523 35.4816C89.3448 45.3717 91.6977 63.7597 81.8076 76.5523C71.9174 89.3448 53.5295 91.6977 40.7369 81.8076ZM112.058 136.947C99.2659 127.057 96.913 108.669 106.803 95.8767C116.693 83.0842 135.081 80.7313 147.874 90.6214C160.666 100.512 163.019 118.9 153.129 131.692C143.239 144.485 124.851 146.838 112.058 136.947Z',
            'M0 0V176H172V0L85.6546 121.574L0 0Z',
            'M97.5 0L123.834 71.1662L195 97.5L123.834 123.834L97.5 195L71.1662 123.834L0 97.5L71.1662 71.1662L97.5 0Z',
            'M79.066 0L157.764 78.6975L79.066 212.132L0.368469 78.6975L79.066 0Z',
            'M14.8283 14.462C34.4554 -4.96283 66.1133 -4.7988 85.5381 14.8283L98 27.4201L110.462 14.8283C129.887 -4.7988 161.545 -4.96283 181.172 14.462C200.799 33.8867 200.963 65.5446 181.538 85.1717L98 169.58L14.462 85.1717C-4.96283 65.5446 -4.7988 33.8867 14.8283 14.462Z'
        ];

        Point[11] memory msc = [
            Point(198, 205),
            Point(210, 185),
            Point(211, 185),
            Point(203, 189),
            Point(203, 193),
            Point(210, 185),
            Point(202, 205),
            Point(212, 204),
            Point(200, 185),
            Point(219, 173),
            Point(201, 201)
        ];

        Shapes[11] memory mscs = [
            Shapes(
                'M21 5C21 6.10457 16.9706 7 12 7C7.02944 7 3 6.10457 3 5C3 3.89543 7.02944 3 12 3C16.9706 3 21 3.89543 21 5Z',
                20,
                291
            ),
            Shapes(
                'M113 5C113 6.10457 88.3757 7 58 7C27.6243 7 3 6.10457 3 5C3 3.89543 27.6243 3 58 3C88.3757 3 113 3.89543 113 5Z',
                110,
                240
            ),
            Shapes(
                'M178 5C178 6.10457 138.825 7 90.5 7C42.1751 7 3 6.10457 3 5C3 3.89543 42.1751 3 90.5 3C138.825 3 178 3.89543 178 5Z',
                175,
                207
            ),
            Shapes(
                'M21 5C21 6.10457 16.9706 7 12 7C7.02944 7 3 6.10457 3 5C3 3.89543 7.02944 3 12 3C16.9706 3 21 3.89543 21 5Z',
                20,
                291
            ),
            Shapes(
                'M121 5C121 6.10457 94.5848 7 62 7C29.4152 7 3 6.10457 3 5C3 3.89543 29.4152 3 62 3C94.5848 3 121 3.89543 121 5Z',
                118,
                237
            ),
            Shapes(
                'M113 5C113 6.10457 88.3757 7 58 7C27.6243 7 3 6.10457 3 5C3 3.89543 27.6243 3 58 3C88.3757 3 113 3.89543 113 5Z',
                110,
                245
            ),
            Shapes(
                'M81 5C81 6.10457 63.5391 7 42 7C20.4609 7 3 6.10457 3 5C3 3.89543 20.4609 3 42 3C63.5391 3 81 3.89543 81 5Z',
                80,
                294
            ),
            Shapes(
                'M175 5C175 6.10457 136.496 7 89 7C41.5035 7 3 6.10457 3 5C3 3.89543 41.5035 3 89 3C136.496 3 175 3.89543 175 5Z',
                172,
                212
            ),
            Shapes(
                'M21 5C21 6.10457 16.9706 7 12 7C7.02944 7 3 6.10457 3 5C3 3.89543 7.02944 3 12 3C16.9706 3 21 3.89543 21 5Z',
                20,
                291
            ),
            Shapes(
                'M21 5C21 6.10457 16.9706 7 12 7C7.02944 7 3 6.10457 3 5C3 3.89543 7.02944 3 12 3C16.9706 3 21 3.89543 21 5Z',
                20,
                291
            ),
            Shapes(
                'M21 5C21 6.10457 16.9706 7 12 7C7.02944 7 3 6.10457 3 5C3 3.89543 7.02944 3 12 3C16.9706 3 21 3.89543 21 5Z',
                20,
                291
            )
        ];
        Point[3][3][11] memory ssc = [
            countMatrix(201, 174, mainShape, msc),
            countMatrix(195, 195, mainShape, msc),
            countMatrix(175, 175, mainShape, msc),
            countMatrix(190, 190, mainShape, msc),
            countMatrix(180, 180, mainShape, msc),
            countMatrix(195, 195, mainShape, msc),
            countMatrix(188, 172, mainShape, msc),
            countMatrix(172, 176, mainShape, msc),
            countMatrix(195, 195, mainShape, msc),
            countMatrix(157, 212, mainShape, msc),
            countMatrix(196, 170, mainShape, msc)
        ];

        Shapes[10] memory sShapes = [
            Shapes('M75.3585 0L84.2517 8.89323L8.89318 84.2518L-4.334e-05 75.3586L75.3585 0Z', 85, 85),
            Shapes(
                'M76.5141 41.507C73.822 46.1699 70.2378 50.2568 65.9663 53.5345C61.6947 56.8122 56.8194 59.2165 51.6186 60.61C46.4179 62.0035 40.9936 62.3591 35.6555 61.6563C30.3173 60.9535 25.1699 59.2062 20.507 56.5141C15.8442 53.822 11.7572 50.2378 8.47955 45.9663C5.20186 41.6947 2.79761 36.8193 1.40408 31.6186C0.0105474 26.4179 -0.344978 20.9936 0.357801 15.6555C1.06058 10.3173 2.8079 5.16989 5.5 0.507034L41.007 21.007L76.5141 41.507Z',
                77,
                63
            ),
            Shapes('M0 8.89323L8.89323 0L126.065 117.172L117.172 126.065L0 8.89323Z', 127, 127),
            Shapes('M21.5001 0.993896L42.7133 22.2071L21.5001 43.4203L0.286865 22.2071L21.5001 0.993896Z', 44, 44),
            Shapes(
                'M0.350448 32.0089C0.126278 28.0756 0.679019 24.1367 1.97711 20.417C3.2752 16.6974 5.29323 13.2698 7.91596 10.3301C10.5387 7.3903 13.7148 4.99592 17.2629 3.28362C20.8109 1.57131 24.6615 0.574621 28.5948 0.350451C32.5281 0.126282 36.467 0.679023 40.1867 1.97712C43.9063 3.27521 47.3339 5.29323 50.2736 7.91596C53.2134 10.5387 55.6078 13.7148 57.3201 17.2629C59.0324 20.8109 60.0291 24.6616 60.2532 28.5948L49.4805 29.2088C49.3369 26.6902 48.6987 24.2246 47.6023 21.9527C46.5059 19.6807 44.9727 17.647 43.0903 15.9676C41.2079 14.2882 39.0131 12.996 36.6313 12.1648C34.2496 11.3336 31.7274 10.9797 29.2088 11.1232C26.6902 11.2668 24.2246 11.905 21.9527 13.0014C19.6807 14.0978 17.647 15.631 15.9676 17.5134C14.2882 19.3958 12.996 21.5906 12.1648 23.9723C11.3336 26.3541 10.9797 28.8763 11.1232 31.3949L0.350448 32.0089Z',
                61,
                33
            ),
            Shapes(
                'M20 -8.74228e-07C31.0457 -3.91405e-07 40 8.95431 40 20V20C40 31.0457 31.0457 40 20 40V40C8.9543 40 -1.35705e-06 31.0457 -8.74228e-07 20L0 -1.74846e-06L20 -8.74228e-07Z',
                40,
                40
            ),
            Shapes('M15 0L29.7225 8.5V25.5L15 34L0.277588 25.5V8.5L15 0Z', 30, 34),
            Shapes('M52 0L103.096 24H0.904541L52 0Z', 104, 24),
            Shapes('M28.5 0H0L20.5 31L0 61.5H28.5L42.5 31L28.5 0Z', 43, 62),
            Shapes(
                'M0.526415 10.7754C4.38839 6.27083 9.49938 3.01265 15.2131 1.41286C20.9268 -0.18693 26.9866 -0.0564867 32.6261 1.7877C38.2657 3.63188 43.2317 7.10697 46.8963 11.7735C50.5609 16.4401 52.7593 22.0885 53.2137 28.0045C53.668 33.9205 52.3579 39.8384 49.4489 45.0099C46.54 50.1813 42.1628 54.374 36.871 57.0577C31.5792 59.7414 25.6104 60.7957 19.7194 60.0872C13.8284 59.3787 8.27984 56.9392 3.7753 53.0772L23.3018 30.3018L0.526415 10.7754Z',
                54,
                61
            )
        ];
        params.sideShapes = SVGStrings.getSideShapesString(sides, idHash, ssc, sShapes, sidesAnimations);
        params.msc_mainShape = msc[mainShape];
        params.mscs_mainShape = mscs[mainShape];
        params.ms_mainShape = ms[mainShape];

        return SVGStrings.getMainShapeString(params);
    }
}
