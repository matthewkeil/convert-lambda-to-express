echo $GITHUB_REF
if grep -q "tags/v" <<< $GITHUB_REF; then
    VERSION=${GITHUB_REF#refs/tags/v} 
    echo GITHUB_REF is version: $VERSION
    echo "::set-output name=VERSION::${VERSION}"
elif grep -q "tags" <<< $GITHUB_REF; then
    TAG=${GITHUB_REF#refs/tags/} 
    echo GITHUB_REF is tag: $TAG
    echo "::set-output name=TAG::${TAG}"
else
    BRANCH=${GITHUB_REF#refs/heads/} 
    echo "::set-output name=BRANCH::${BRANCH}"
    echo GITHUB_REF is branch: $BRANCH
fi