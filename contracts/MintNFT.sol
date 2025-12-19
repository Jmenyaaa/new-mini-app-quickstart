// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";

contract MintNFT is ERC721URIStorage, Ownable {
    // Используем native uint256 counter вместо OpenZeppelin Counters
    uint256 private _tokenIdCounter;

    constructor() ERC721("GradientNFT", "GRAD") {}

    // Функция минта NFT
    function mintNFT(address to, string memory uri) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    // Получить текущий ID
    function getCurrentTokenId() public view returns (uint256) {
        return _tokenIdCounter;
    }

    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721URIStorage)
    {
        super._burn(tokenId);
    }
}
