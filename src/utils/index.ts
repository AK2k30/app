export const getCurrentDate = () => {
    const today = new Date();
    const formattedDate = today
        .toLocaleDateString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
        .split("/")
        .reverse()
        .join("-");
    return formattedDate;
};

export const dateFormat = (dateVal: Date) => {
    //const today = new Date();
    const formattedDate = dateVal
        .toLocaleDateString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
        .split("/")
        .reverse()
        .join("-");
    return formattedDate;
};  